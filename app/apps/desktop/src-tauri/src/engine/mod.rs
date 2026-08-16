use crate::classification::EventClassification;
use crate::parser::{parse_line, ParseOutcome, RawLogLine};
use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

#[derive(Debug, Clone)]
pub struct CombatLogSummary {
    pub line_count: u64,
    pub parsed_count: u64,
    pub failed_count: u64,
    pub classification_counts: Vec<ClassificationCount>,
    pub party_damage: Vec<DamageRow>,
    pub companion_damage: Vec<DamageRow>,
    pub recent_events: Vec<RecentEvent>,
}

#[derive(Debug, Clone)]
pub struct ClassificationCount {
    pub classification: String,
    pub count: u64,
}

#[derive(Debug, Clone)]
pub struct RecentEvent {
    pub timestamp: Option<String>,
    pub classification: String,
    pub summary: String,
}

#[derive(Debug, Clone)]
pub struct DamageRow {
    pub rank: u32,
    pub name: String,
    pub total_damage: f64,
    pub hit_count: u64,
    pub crit_count: u64,
    pub crit_rate: f64,
    pub top_power: Option<String>,
    pub source_kind: String,
    pub owner_name: Option<String>,
    pub power_breakdown: Vec<PowerBreakdown>,
    pub damage_trend: Vec<f64>,
}

#[derive(Debug, Clone)]
pub struct PowerBreakdown {
    pub power_name: String,
    pub total_damage: f64,
    pub hit_count: u64,
}

pub fn summarize_combat_log(path: &Path, skip_lines: u64) -> Result<CombatLogSummary, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let mut reader = BufReader::new(file);
    let mut absolute_line_index = 0_u64;
    let mut byte_offset = 0_u64;
    let mut line_count = 0_u64;
    let mut parsed_count = 0_u64;
    let mut failed_count = 0_u64;
    let mut recent_events = Vec::new();
    let mut counts = BTreeMap::<String, u64>::new();
    let mut damage_by_member = BTreeMap::<String, DamageAccumulator>::new();
    let mut damage_by_companion = BTreeMap::<String, DamageAccumulator>::new();

    loop {
        let mut raw_text = String::new();
        let bytes_read = reader
            .read_line(&mut raw_text)
            .map_err(|error| error.to_string())?;

        if bytes_read == 0 {
            break;
        }

        let current_offset = byte_offset;
        byte_offset += bytes_read as u64;

        if absolute_line_index < skip_lines {
            absolute_line_index += 1;
            continue;
        }

        let raw_text = raw_text.trim_end_matches(['\r', '\n']).to_string();
        line_count += 1;

        let outcome = parse_line(RawLogLine {
            id: uuid::Uuid::new_v4(),
            log_file_id: None,
            line_index: absolute_line_index as i64,
            byte_offset: current_offset as i64,
            raw_text: raw_text.clone(),
        });

        match outcome {
            ParseOutcome::Parsed(event) => {
                parsed_count += 1;
                let classification = format!("{:?}", event.classification);
                *counts.entry(classification.clone()).or_default() += 1;
                if is_damage_classification(event.classification) && is_canonical_published_damage(&event) {
                    apply_damage_event(&mut damage_by_member, &mut damage_by_companion, &event);
                }
                recent_events.push(RecentEvent {
                    timestamp: Some(event.timestamp_raw),
                    classification,
                    summary: event.power_name.or(event.event_type).unwrap_or(raw_text),
                });
            }
            ParseOutcome::Failed(error) => {
                failed_count += 1;
                *counts.entry("ParseFailure".to_string()).or_default() += 1;
                recent_events.push(RecentEvent {
                    timestamp: error.timestamp_raw,
                    classification: "ParseFailure".to_string(),
                    summary: error.message,
                });
            }
        }

        if recent_events.len() > 8 {
            recent_events.remove(0);
        }

        absolute_line_index += 1;
    }

    Ok(CombatLogSummary {
        line_count,
        parsed_count,
        failed_count,
        classification_counts: counts
            .into_iter()
            .map(|(classification, count)| ClassificationCount {
                classification,
                count,
            })
            .collect(),
        party_damage: ranked_damage(damage_by_member, "player"),
        companion_damage: ranked_damage(damage_by_companion, "companion"),
        recent_events,
    })
}

pub fn count_log_lines(path: &Path) -> Result<u64, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let mut reader = BufReader::new(file);
    let mut lines = 0_u64;

    loop {
        let mut raw_text = String::new();
        let bytes_read = reader
            .read_line(&mut raw_text)
            .map_err(|error| error.to_string())?;
        if bytes_read == 0 {
            break;
        }
        lines += 1;
    }

    Ok(lines)
}

fn is_canonical_published_damage(event: &crate::parser::ParsedEvent) -> bool {
    if event.amount1.unwrap_or_default() <= 0.0 {
        return false;
    }
    if !event
        .event_type
        .as_deref()
        .map(|value| value.eq_ignore_ascii_case("physical"))
        .unwrap_or(false)
    {
        return false;
    }
    if !is_player_ref(event.owner_ref.as_deref()) {
        return false;
    }
    !event.flags.iter().any(|flag| {
        flag.eq_ignore_ascii_case("immune") || flag.eq_ignore_ascii_case("showpowerdisplayname")
    })
}

fn apply_damage_event(
    damage_by_member: &mut BTreeMap<String, DamageAccumulator>,
    damage_by_companion: &mut BTreeMap<String, DamageAccumulator>,
    event: &crate::parser::ParsedEvent,
) {
    let Some(amount) = event.amount1 else {
        return;
    };

    if amount <= 0.0 {
        return;
    }

    let source_name = clean_log_name(event.source_primary_name.clone());
    let owner_name = clean_log_name(event.owner_name.clone());
    let source_ref = event.source_primary_ref.as_deref();
    let owner_ref = event.owner_ref.as_deref();
    let is_companion = source_name
        .as_deref()
        .map(|name| is_companion_source(name, source_ref))
        .unwrap_or_else(|| source_ref.map(is_companion_ref).unwrap_or(false));
    let is_owner_player = is_player_ref(owner_ref);

    if !is_owner_player {
        return;
    }

    if is_companion {
        if let Some(name) = source_name {
            let inferred_owner = owner_name
                .filter(|owner| owner != &name)
                .or_else(|| infer_companion_owner_name(&name));
            let entry = damage_by_companion.entry(name).or_default();
            if entry.owner_name.is_none() {
                entry.owner_name = inferred_owner;
            }
            add_damage_to_accumulator(entry, amount, &event.flags, event.power_name.clone());
        }
    } else if let Some(name) = owner_name.or(source_name) {
        let entry = damage_by_member.entry(name).or_default();
        add_damage_to_accumulator(entry, amount, &event.flags, event.power_name.clone());
    }
}

#[derive(Debug, Default)]
struct DamageAccumulator {
    total_damage: f64,
    hit_count: u64,
    crit_count: u64,
    power_damage: BTreeMap<String, f64>,
    power_hits: BTreeMap<String, u64>,
    owner_name: Option<String>,
    damage_events: Vec<f64>,
}

fn is_damage_classification(classification: EventClassification) -> bool {
    matches!(
        classification,
        EventClassification::DirectDamage
            | EventClassification::DotDamage
            | EventClassification::ShieldDamage
    )
}

fn add_damage_to_accumulator(
    entry: &mut DamageAccumulator,
    amount: f64,
    flags: &[String],
    power_name: Option<String>,
) {
    entry.total_damage += amount;
    entry.hit_count += 1;
    entry.damage_events.push(amount);
    if flags
        .iter()
        .any(|flag| flag.eq_ignore_ascii_case("critical"))
    {
        entry.crit_count += 1;
    }
    if let Some(power_name) = power_name {
        *entry.power_damage.entry(power_name.clone()).or_default() += amount;
        *entry.power_hits.entry(power_name).or_default() += 1;
    }
}

fn clean_log_name(value: Option<String>) -> Option<String> {
    value
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty() && name != "*")
}

fn is_player_ref(reference: Option<&str>) -> bool {
    reference
        .map(|reference| reference.trim_start().starts_with("P["))
        .unwrap_or(false)
}

fn ranked_damage(
    damage_by_member: BTreeMap<String, DamageAccumulator>,
    source_kind: &str,
) -> Vec<DamageRow> {
    let mut rows: Vec<_> = damage_by_member
        .into_iter()
        .map(|(name, damage)| {
            let DamageAccumulator {
                total_damage,
                hit_count,
                crit_count,
                power_damage,
                power_hits,
                owner_name,
                damage_events,
            } = damage;
            let top_power = power_damage
                .iter()
                .max_by(|(_, left), (_, right)| left.total_cmp(right))
                .map(|(power, _)| power.clone());
            let mut power_breakdown: Vec<_> = power_damage
                .into_iter()
                .map(|(power_name, total_damage)| PowerBreakdown {
                    hit_count: *power_hits.get(&power_name).unwrap_or(&0),
                    power_name,
                    total_damage,
                })
                .collect();
            power_breakdown.sort_by(|left, right| right.total_damage.total_cmp(&left.total_damage));
            DamageRow {
                rank: 0,
                name,
                total_damage,
                hit_count,
                crit_count,
                crit_rate: if hit_count == 0 {
                    0.0
                } else {
                    crit_count as f64 / hit_count as f64
                },
                top_power,
                source_kind: source_kind.to_string(),
                owner_name: if source_kind == "companion" {
                    owner_name
                } else {
                    None
                },
                power_breakdown,
                damage_trend: compress_damage_trend(&damage_events),
            }
        })
        .collect();

    rows.sort_by(|left, right| right.total_damage.total_cmp(&left.total_damage));

    for (index, row) in rows.iter_mut().enumerate() {
        row.rank = index as u32 + 1;
    }

    rows
}

fn is_companion_ref(source_ref: &str) -> bool {
    let normalized_ref = source_ref.to_ascii_lowercase();
    normalized_ref.contains("pet_")
        || normalized_ref.contains("companion")
        || normalized_ref.contains("appointment")
        || normalized_ref.contains("summon")
}

fn is_companion_source(name: &str, source_ref: Option<&str>) -> bool {
    let normalized_name = name.to_ascii_lowercase();
    if normalized_name.contains("companion")
        || normalized_name.contains("summon")
        || normalized_name.contains("pet")
        || normalized_name.contains("appointment")
    {
        return true;
    }

    source_ref.map(is_companion_ref).unwrap_or(false)
}

fn infer_companion_owner_name(name: &str) -> Option<String> {
    let trimmed = name.trim();

    for marker in ["'s "] {
        if let Some((owner, _)) = trimmed.split_once(marker) {
            let owner = owner.trim();
            if !owner.is_empty() {
                return Some(owner.to_string());
            }
        }
    }

    for marker in [" - "] {
        if let Some((owner, companion)) = trimmed.split_once(marker) {
            let companion = companion.to_ascii_lowercase();
            if companion.contains("companion")
                || companion.contains("summon")
                || companion.contains("pet")
            {
                let owner = owner.trim();
                if !owner.is_empty() {
                    return Some(owner.to_string());
                }
            }
        }
    }

    if let Some(start) = trimmed.rfind('(') {
        if trimmed.ends_with(')') {
            let owner = trimmed[start + 1..trimmed.len() - 1].trim();
            if !owner.is_empty() {
                return Some(owner.to_string());
            }
        }
    }

    None
}

fn compress_damage_trend(events: &[f64]) -> Vec<f64> {
    const BUCKETS: usize = 24;

    if events.is_empty() {
        return Vec::new();
    }

    if events.len() <= BUCKETS {
        return events.to_vec();
    }

    let mut trend = vec![0.0; BUCKETS];
    for (index, amount) in events.iter().enumerate() {
        let bucket = index * BUCKETS / events.len();
        trend[bucket] += amount;
    }

    trend
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn summarizes_damage_after_skipped_baseline() {
        let path =
            std::env::temp_dir().join(format!("nexus-combat-summary-{}.log", uuid::Uuid::new_v4()));
        let contents = [
            "bad first line",
            "24:01:01:00:00:01.0::Player,P[1],Player,P[1],Boss,C[1],Strike,Pn.1,Physical,Critical,100,120",
            "24:01:01:00:00:02.0::Player,P[1],Player,P[1],Boss,C[1],Strike,Pn.1,Physical,,50,60",
        ]
        .join("\r\n");
        fs::write(&path, contents).expect("test log should be writable");

        let summary = summarize_combat_log(&path, 1).expect("summary should parse");

        fs::remove_file(&path).ok();
        assert_eq!(summary.line_count, 2);
        assert_eq!(summary.parsed_count, 2);
        assert_eq!(summary.failed_count, 0);
        assert_eq!(summary.party_damage.len(), 1);
        assert_eq!(summary.party_damage[0].name, "Player");
        assert_eq!(summary.party_damage[0].total_damage, 150.0);
        assert_eq!(summary.party_damage[0].crit_count, 1);
    }

    #[test]
    fn publishes_only_canonical_physical_player_owned_damage() {
        let path =
            std::env::temp_dir().join(format!("nexus-canonical-summary-{}.log", uuid::Uuid::new_v4()));
        let contents = [
            "26:08:14:10:00:00.0::Player,P[123],Player,P[123],Boss,C[99 M33_Test_Boss],Physical Hit,Pn.1,Physical,,100,100",
            "26:08:14:10:00:01.0::Player,P[123],Player,P[123],Boss,C[99 M33_Test_Boss],Poison Proc,Pn.2,Poison,,900,0",
            "26:08:14:10:00:02.0::Player,P[123],Player,P[123],Boss,C[99 M33_Test_Boss],Display Marker,Pn.3,Physical,ShowPowerDisplayName,800,0",
            "26:08:14:10:00:03.0::Enemy,C[77 M33_Test_Elite],Enemy,C[77 M33_Test_Elite],Player,P[123],Enemy Hit,Pn.4,Physical,,700,700",
            "26:08:14:10:00:04.0::Player,P[123],Wolf,C[10 Pet_Wolf_Companion],Boss,C[99 M33_Test_Boss],Bite,Pn.5,Physical,,50,50",
        ]
        .join("\r\n");
        fs::write(&path, contents).expect("test log should be writable");

        let summary = summarize_combat_log(&path, 0).expect("summary should parse");

        fs::remove_file(&path).ok();
        assert_eq!(summary.party_damage.len(), 1);
        assert_eq!(summary.party_damage[0].total_damage, 100.0);
        assert_eq!(summary.party_damage[0].hit_count, 1);
        assert_eq!(summary.companion_damage.len(), 1);
        assert_eq!(summary.companion_damage[0].total_damage, 50.0);
        assert_eq!(summary.companion_damage[0].hit_count, 1);
    }
}