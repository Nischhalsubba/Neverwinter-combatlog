use crate::classification::EventClassification;
use crate::parser::{parse_line, ParseOutcome, RawLogLine};
use crate::runtime_state::{
    AppRuntimeState, ImportedClassificationCount, ImportedLog, ImportedPartyDamage,
    ImportedPowerBreakdown, LiveHistoryRecord,
};
use crate::source::{detect_latest_combat_log, SourceState, SourceStatus};
use crate::widget;
use serde::Serialize;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use tauri::State;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceStatusDto {
    pub state: String,
    pub path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedLogDto {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub line_count: u64,
    pub parsed_count: u64,
    pub failed_count: u64,
    pub classification_counts: Vec<ClassificationCountDto>,
    pub party_damage: Vec<PartyDamageDto>,
    pub companion_damage: Vec<PartyDamageDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveSourcePreviewDto {
    pub path: Option<String>,
    pub line_count: u64,
    pub parsed_count: u64,
    pub failed_count: u64,
    pub classification_counts: Vec<ClassificationCountDto>,
    pub party_damage: Vec<PartyDamageDto>,
    pub companion_damage: Vec<PartyDamageDto>,
    pub history: Vec<LiveHistoryRecordDto>,
    pub recent_events: Vec<RecentEventDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveHistoryRecordDto {
    pub id: String,
    pub title: String,
    pub source_path: String,
    pub line_count: u64,
    pub parsed_count: u64,
    pub failed_count: u64,
    pub total_damage: f64,
    pub party_damage: Vec<PartyDamageDto>,
    pub companion_damage: Vec<PartyDamageDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationCountDto {
    pub classification: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentEventDto {
    pub timestamp: Option<String>,
    pub classification: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartyDamageDto {
    pub rank: u32,
    pub name: String,
    pub total_damage: f64,
    pub hit_count: u64,
    pub crit_count: u64,
    pub crit_rate: f64,
    pub top_power: Option<String>,
    pub source_kind: String,
    pub owner_name: Option<String>,
    pub power_breakdown: Vec<PowerBreakdownDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerBreakdownDto {
    pub power_name: String,
    pub total_damage: f64,
    pub hit_count: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetStatusDto {
    pub is_open: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveRankingRowDto {
    pub rank: u32,
    pub name: String,
    pub enc_dps: f64,
    pub total_damage: f64,
    pub boss_damage: f64,
    pub crit_rate: f64,
    pub deaths: u32,
}

#[tauri::command]
pub fn get_source_status(state: State<'_, AppRuntimeState>) -> SourceStatusDto {
    source_status_to_dto(state.source_status())
}

#[tauri::command]
pub fn choose_live_log_folder(
    state: State<'_, AppRuntimeState>,
) -> Result<SourceStatusDto, String> {
    let Some(folder) = rfd::FileDialog::new()
        .set_title("Choose Neverwinter log folder")
        .pick_folder()
    else {
        return Ok(source_status_to_dto(state.source_status()));
    };

    set_live_folder_path(&state, folder)
}

#[tauri::command]
pub fn choose_live_log_file(state: State<'_, AppRuntimeState>) -> Result<SourceStatusDto, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("Choose Neverwinter combat log")
        .add_filter("Combat logs", &["log"])
        .pick_file()
    else {
        return Ok(source_status_to_dto(state.source_status()));
    };

    set_live_file_path(&state, path)
}

#[tauri::command]
pub fn set_live_log_folder(
    path: String,
    state: State<'_, AppRuntimeState>,
) -> Result<SourceStatusDto, String> {
    set_live_folder_path(&state, PathBuf::from(path))
}

#[tauri::command]
pub fn set_live_log_file(
    path: String,
    state: State<'_, AppRuntimeState>,
) -> Result<SourceStatusDto, String> {
    set_live_file_path(&state, PathBuf::from(path))
}

#[tauri::command]
pub fn get_live_source_preview(
    state: State<'_, AppRuntimeState>,
) -> Result<LiveSourcePreviewDto, String> {
    let status = state.source_status();
    let Some(path) = status.path else {
        return Ok(empty_preview(None));
    };

    if !path.is_file() {
        return Ok(empty_preview(Some(path)));
    }

    let baseline = state.live_baseline_for(&path);
    let mut preview = summarize_combat_log(&path, baseline)?;
    preview.history = live_history_to_dto(state.live_history());
    Ok(preview)
}

#[tauri::command]
pub fn reset_live_counter(
    state: State<'_, AppRuntimeState>,
) -> Result<LiveSourcePreviewDto, String> {
    let status = state.source_status();
    let Some(path) = status.path else {
        return Ok(empty_preview(None));
    };

    if !path.is_file() {
        return Ok(empty_preview(Some(path)));
    }

    let baseline = state.live_baseline_for(&path);
    let summary = summarize_combat_log(&path, baseline)?;
    if summary.line_count > 0 || summary.parsed_count > 0 || summary.failed_count > 0 {
        let total_damage = summary
            .party_damage
            .iter()
            .chain(summary.companion_damage.iter())
            .map(|row| row.total_damage)
            .sum();
        let record = LiveHistoryRecord {
            id: uuid::Uuid::new_v4().to_string(),
            title: format!("Session {}", state.live_history().len() + 1),
            source_path: path.clone(),
            line_count: summary.line_count,
            parsed_count: summary.parsed_count,
            failed_count: summary.failed_count,
            total_damage,
            party_damage: summary
                .party_damage
                .into_iter()
                .map(dto_to_imported_party_damage)
                .collect(),
            companion_damage: summary
                .companion_damage
                .into_iter()
                .map(dto_to_imported_party_damage)
                .collect(),
        };
        state.push_live_history(record);
    }

    let total_lines = count_lines(&path)?;
    state.set_live_baseline(path.clone(), total_lines);
    let mut preview = summarize_combat_log(&path, total_lines)?;
    preview.history = live_history_to_dto(state.live_history());
    Ok(preview)
}

#[tauri::command]
pub fn get_imported_logs(state: State<'_, AppRuntimeState>) -> Vec<ImportedLogDto> {
    state
        .imported_logs()
        .into_iter()
        .map(imported_log_to_dto)
        .collect()
}

#[tauri::command]
pub fn import_log_files(state: State<'_, AppRuntimeState>) -> Result<Vec<ImportedLogDto>, String> {
    let Some(paths) = rfd::FileDialog::new()
        .set_title("Import recorded combat logs")
        .add_filter("Combat logs", &["log"])
        .pick_files()
    else {
        return Ok(state
            .imported_logs()
            .into_iter()
            .map(imported_log_to_dto)
            .collect());
    };

    import_paths(&state, paths)
}

#[tauri::command]
pub fn import_log_file_paths(
    paths: Vec<String>,
    state: State<'_, AppRuntimeState>,
) -> Result<Vec<ImportedLogDto>, String> {
    import_paths(&state, paths.into_iter().map(PathBuf::from).collect())
}

fn import_paths(
    state: &State<'_, AppRuntimeState>,
    paths: Vec<PathBuf>,
) -> Result<Vec<ImportedLogDto>, String> {
    let logs = paths
        .into_iter()
        .filter(|path| path.is_file())
        .map(read_imported_log)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(state
        .add_imported_logs(logs)
        .into_iter()
        .map(imported_log_to_dto)
        .collect())
}

#[tauri::command]
pub fn get_live_rankings() -> Vec<LiveRankingRowDto> {
    Vec::new()
}

#[tauri::command]
pub fn get_widget_status(
    app: tauri::AppHandle,
    state: State<'_, AppRuntimeState>,
) -> WidgetStatusDto {
    let is_open = widget::is_widget_window_open(&app);
    state.set_widget_open(is_open);
    WidgetStatusDto { is_open }
}

#[tauri::command]
pub fn open_widget_window(
    app: tauri::AppHandle,
    state: State<'_, AppRuntimeState>,
) -> Result<WidgetStatusDto, String> {
    widget::open_widget_window(&app).map_err(|error| error.to_string())?;
    state.set_widget_open(true);
    Ok(WidgetStatusDto { is_open: true })
}

#[tauri::command]
pub fn close_widget_window(
    app: tauri::AppHandle,
    state: State<'_, AppRuntimeState>,
) -> Result<WidgetStatusDto, String> {
    widget::close_widget_window(&app).map_err(|error| error.to_string())?;
    state.set_widget_open(false);
    Ok(WidgetStatusDto { is_open: false })
}

#[tauri::command]
pub fn toggle_widget_window(
    app: tauri::AppHandle,
    state: State<'_, AppRuntimeState>,
) -> Result<WidgetStatusDto, String> {
    if widget::is_widget_window_open(&app) || state.widget_open() {
        close_widget_window(app, state)
    } else {
        open_widget_window(app, state)
    }
}

fn source_status_to_dto(status: SourceStatus) -> SourceStatusDto {
    SourceStatusDto {
        state: match status.state {
            SourceState::Missing => "missing",
            SourceState::Ready => "ready",
            SourceState::Watching => "watching",
            SourceState::Warning => "warning",
            SourceState::Disconnected => "disconnected",
        }
        .to_string(),
        path: status.path.map(|path| path.display().to_string()),
        message: status.message,
    }
}

fn set_live_folder_path(
    state: &State<'_, AppRuntimeState>,
    folder: PathBuf,
) -> Result<SourceStatusDto, String> {
    let status = match detect_latest_combat_log(&folder) {
        Some(path) => SourceStatus {
            state: SourceState::Watching,
            message: format!("Watching latest combat log: {}", file_label(&path)),
            path: Some(path),
        },
        None => SourceStatus {
            state: SourceState::Warning,
            message: "No Combat*.log file found in the selected folder".to_string(),
            path: Some(folder),
        },
    };

    state.set_source_status(status.clone());
    Ok(source_status_to_dto(status))
}

fn set_live_file_path(
    state: &State<'_, AppRuntimeState>,
    path: PathBuf,
) -> Result<SourceStatusDto, String> {
    let status = if path.is_file() {
        SourceStatus {
            state: SourceState::Watching,
            message: format!("Watching combat log: {}", file_label(&path)),
            path: Some(path),
        }
    } else {
        SourceStatus {
            state: SourceState::Warning,
            message: "Selected combat log file could not be found".to_string(),
            path: Some(path),
        }
    };

    state.set_source_status(status.clone());
    Ok(source_status_to_dto(status))
}

fn imported_log_to_dto(log: ImportedLog) -> ImportedLogDto {
    ImportedLogDto {
        path: log.path.display().to_string(),
        name: log.name,
        size_bytes: log.size_bytes,
        line_count: log.line_count,
        parsed_count: log.parsed_count,
        failed_count: log.failed_count,
        classification_counts: log
            .classification_counts
            .into_iter()
            .map(|item| ClassificationCountDto {
                classification: item.classification,
                count: item.count,
            })
            .collect(),
        party_damage: log
            .party_damage
            .into_iter()
            .map(imported_party_damage_to_dto)
            .collect(),
        companion_damage: log
            .companion_damage
            .into_iter()
            .map(imported_party_damage_to_dto)
            .collect(),
    }
}

fn read_imported_log(path: PathBuf) -> Result<ImportedLog, String> {
    let metadata = std::fs::metadata(&path).map_err(|error| error.to_string())?;
    let summary = summarize_combat_log(&path, 0)?;

    Ok(ImportedLog {
        name: file_label(&path),
        path,
        size_bytes: metadata.len(),
        line_count: summary.line_count,
        parsed_count: summary.parsed_count,
        failed_count: summary.failed_count,
        classification_counts: summary
            .classification_counts
            .into_iter()
            .map(|item| ImportedClassificationCount {
                classification: item.classification,
                count: item.count,
            })
            .collect(),
        party_damage: summary
            .party_damage
            .into_iter()
            .map(|item| ImportedPartyDamage {
                rank: item.rank,
                name: item.name,
                total_damage: item.total_damage,
                hit_count: item.hit_count,
                crit_count: item.crit_count,
                top_power: item.top_power,
                source_kind: item.source_kind,
                owner_name: item.owner_name,
                power_breakdown: item
                    .power_breakdown
                    .into_iter()
                    .map(|power| ImportedPowerBreakdown {
                        power_name: power.power_name,
                        total_damage: power.total_damage,
                        hit_count: power.hit_count,
                    })
                    .collect(),
            })
            .collect(),
        companion_damage: summary
            .companion_damage
            .into_iter()
            .map(|item| ImportedPartyDamage {
                rank: item.rank,
                name: item.name,
                total_damage: item.total_damage,
                hit_count: item.hit_count,
                crit_count: item.crit_count,
                top_power: item.top_power,
                source_kind: item.source_kind,
                owner_name: item.owner_name,
                power_breakdown: item
                    .power_breakdown
                    .into_iter()
                    .map(|power| ImportedPowerBreakdown {
                        power_name: power.power_name,
                        total_damage: power.total_damage,
                        hit_count: power.hit_count,
                    })
                    .collect(),
            })
            .collect(),
    })
}

fn summarize_combat_log(path: &Path, skip_lines: u64) -> Result<LiveSourcePreviewDto, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let reader = BufReader::new(file);
    let mut line_count = 0_u64;
    let mut parsed_count = 0_u64;
    let mut failed_count = 0_u64;
    let mut recent_events = Vec::new();
    let mut counts = std::collections::BTreeMap::<String, u64>::new();
    let mut damage_by_member = std::collections::BTreeMap::<String, DamageAccumulator>::new();
    let mut damage_by_companion = std::collections::BTreeMap::<String, DamageAccumulator>::new();

    for (index, line_result) in reader.lines().enumerate().skip(skip_lines as usize) {
        let raw_text = line_result.map_err(|error| error.to_string())?;
        line_count += 1;

        let outcome = parse_line(RawLogLine {
            id: uuid::Uuid::new_v4(),
            log_file_id: None,
            line_index: index as i64,
            byte_offset: 0,
            raw_text: raw_text.clone(),
        });

        match outcome {
            ParseOutcome::Parsed(event) => {
                parsed_count += 1;
                let classification = format!("{:?}", event.classification);
                *counts.entry(classification.clone()).or_default() += 1;
                if is_damage_classification(event.classification) {
                    if let (Some(name), Some(amount)) =
                        (event.source_primary_name.clone(), event.amount1)
                    {
                        if amount > 0.0 && name != "*" {
                            let is_companion =
                                is_companion_source(&name, event.source_primary_ref.as_deref());
                            let entry = if is_companion {
                                let owner_name = infer_companion_owner_name(&name);
                                let entry = damage_by_companion.entry(name).or_default();
                                if entry.owner_name.is_none() {
                                    entry.owner_name = owner_name;
                                }
                                entry
                            } else {
                                damage_by_member.entry(name).or_default()
                            };
                            entry.total_damage += amount;
                            entry.hit_count += 1;
                            if event
                                .flags
                                .iter()
                                .any(|flag| flag.eq_ignore_ascii_case("critical"))
                            {
                                entry.crit_count += 1;
                            }
                            if let Some(power_name) = event.power_name.clone() {
                                *entry.power_damage.entry(power_name.clone()).or_default() +=
                                    amount;
                                *entry.power_hits.entry(power_name).or_default() += 1;
                            }
                        }
                    }
                }
                recent_events.push(RecentEventDto {
                    timestamp: Some(event.timestamp_raw),
                    classification,
                    summary: event.power_name.or(event.event_type).unwrap_or(raw_text),
                });
            }
            ParseOutcome::Failed(error) => {
                failed_count += 1;
                *counts.entry("ParseFailure".to_string()).or_default() += 1;
                recent_events.push(RecentEventDto {
                    timestamp: error.timestamp_raw,
                    classification: "ParseFailure".to_string(),
                    summary: error.message,
                });
            }
        }

        if recent_events.len() > 8 {
            recent_events.remove(0);
        }
    }

    Ok(LiveSourcePreviewDto {
        path: Some(path.display().to_string()),
        line_count,
        parsed_count,
        failed_count,
        classification_counts: counts
            .into_iter()
            .map(|(classification, count)| ClassificationCountDto {
                classification,
                count,
            })
            .collect(),
        party_damage: ranked_party_damage(damage_by_member),
        companion_damage: ranked_damage(damage_by_companion, "companion"),
        history: Vec::new(),
        recent_events,
    })
}

fn empty_preview(path: Option<PathBuf>) -> LiveSourcePreviewDto {
    LiveSourcePreviewDto {
        path: path.map(|path| path.display().to_string()),
        line_count: 0,
        parsed_count: 0,
        failed_count: 0,
        classification_counts: Vec::new(),
        party_damage: Vec::new(),
        companion_damage: Vec::new(),
        history: Vec::new(),
        recent_events: Vec::new(),
    }
}

fn count_lines(path: &Path) -> Result<u64, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let reader = BufReader::new(file);
    Ok(reader.lines().count() as u64)
}

#[derive(Debug, Default)]
struct DamageAccumulator {
    total_damage: f64,
    hit_count: u64,
    crit_count: u64,
    power_damage: std::collections::BTreeMap<String, f64>,
    power_hits: std::collections::BTreeMap<String, u64>,
    owner_name: Option<String>,
}

fn is_damage_classification(classification: EventClassification) -> bool {
    matches!(
        classification,
        EventClassification::DirectDamage
            | EventClassification::DotDamage
            | EventClassification::ShieldDamage
    )
}

fn ranked_party_damage(
    damage_by_member: std::collections::BTreeMap<String, DamageAccumulator>,
) -> Vec<PartyDamageDto> {
    ranked_damage(damage_by_member, "player")
}

fn ranked_damage(
    damage_by_member: std::collections::BTreeMap<String, DamageAccumulator>,
    source_kind: &str,
) -> Vec<PartyDamageDto> {
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
            } = damage;
            let top_power = power_damage
                .iter()
                .max_by(|(_, left), (_, right)| left.total_cmp(right))
                .map(|(power, _)| power.clone());
            let mut power_breakdown: Vec<_> = power_damage
                .into_iter()
                .map(|(power_name, total_damage)| PowerBreakdownDto {
                    hit_count: *power_hits.get(&power_name).unwrap_or(&0),
                    power_name,
                    total_damage,
                })
                .collect();
            power_breakdown.sort_by(|left, right| right.total_damage.total_cmp(&left.total_damage));
            PartyDamageDto {
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
            }
        })
        .collect();

    rows.sort_by(|left, right| right.total_damage.total_cmp(&left.total_damage));

    for (index, row) in rows.iter_mut().enumerate() {
        row.rank = index as u32 + 1;
    }

    rows
}

fn is_companion_source(name: &str, source_ref: Option<&str>) -> bool {
    let normalized_name = name.to_ascii_lowercase();
    if normalized_name.contains("companion")
        || normalized_name.contains("summon")
        || normalized_name.contains("pet")
        || normalized_name.contains("artifact")
        || normalized_name.contains("familiar")
    {
        return true;
    }

    source_ref
        .map(|reference| {
            let normalized_ref = reference.to_ascii_lowercase();
            normalized_ref.starts_with("c[")
                || normalized_ref.contains("companion")
                || normalized_ref.contains("pet")
                || normalized_ref.contains("summon")
        })
        .unwrap_or(false)
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

fn imported_party_damage_to_dto(row: ImportedPartyDamage) -> PartyDamageDto {
    PartyDamageDto {
        rank: row.rank,
        name: row.name,
        total_damage: row.total_damage,
        hit_count: row.hit_count,
        crit_count: row.crit_count,
        crit_rate: if row.hit_count == 0 {
            0.0
        } else {
            row.crit_count as f64 / row.hit_count as f64
        },
        top_power: row.top_power,
        source_kind: row.source_kind,
        owner_name: row.owner_name,
        power_breakdown: row
            .power_breakdown
            .into_iter()
            .map(|power| PowerBreakdownDto {
                power_name: power.power_name,
                total_damage: power.total_damage,
                hit_count: power.hit_count,
            })
            .collect(),
    }
}

fn dto_to_imported_party_damage(row: PartyDamageDto) -> ImportedPartyDamage {
    ImportedPartyDamage {
        rank: row.rank,
        name: row.name,
        total_damage: row.total_damage,
        hit_count: row.hit_count,
        crit_count: row.crit_count,
        top_power: row.top_power,
        source_kind: row.source_kind,
        owner_name: row.owner_name,
        power_breakdown: row
            .power_breakdown
            .into_iter()
            .map(|power| ImportedPowerBreakdown {
                power_name: power.power_name,
                total_damage: power.total_damage,
                hit_count: power.hit_count,
            })
            .collect(),
    }
}

fn live_history_to_dto(history: Vec<LiveHistoryRecord>) -> Vec<LiveHistoryRecordDto> {
    history
        .into_iter()
        .map(|record| LiveHistoryRecordDto {
            id: record.id,
            title: record.title,
            source_path: record.source_path.display().to_string(),
            line_count: record.line_count,
            parsed_count: record.parsed_count,
            failed_count: record.failed_count,
            total_damage: record.total_damage,
            party_damage: record
                .party_damage
                .into_iter()
                .map(imported_party_damage_to_dto)
                .collect(),
            companion_damage: record
                .companion_damage
                .into_iter()
                .map(imported_party_damage_to_dto)
                .collect(),
        })
        .collect()
}

fn file_label(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("selected log")
        .to_string()
}
