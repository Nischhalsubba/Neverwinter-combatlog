#[cfg(test)]
mod tests;

use crate::classification::EventClassification;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RawLogLine {
    pub id: Uuid,
    pub log_file_id: Option<Uuid>,
    pub line_index: i64,
    pub byte_offset: i64,
    pub raw_text: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ParsedEvent {
    pub id: Uuid,
    pub raw_line_id: Uuid,
    pub timestamp_raw: String,
    pub timestamp_ms: Option<i64>,
    pub tokens: Vec<String>,
    pub owner_name: Option<String>,
    pub owner_ref: Option<String>,
    pub source_primary_name: Option<String>,
    pub source_primary_ref: Option<String>,
    pub target_primary_name: Option<String>,
    pub target_primary_ref: Option<String>,
    pub power_name: Option<String>,
    pub power_ref: Option<String>,
    pub event_type: Option<String>,
    pub flags: Vec<String>,
    pub amount1: Option<f64>,
    pub amount2: Option<f64>,
    pub classification: EventClassification,
    pub confidence: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ParseFailure {
    pub raw_line_id: Uuid,
    pub timestamp_raw: Option<String>,
    pub tokens: Vec<String>,
    pub error_code: ParseErrorCode,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ParseErrorCode {
    MissingTimestampSeparator,
    EmptyPayload,
    UnterminatedQuote,
    InvalidFieldCount,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ParseOutcome {
    Parsed(ParsedEvent),
    Failed(ParseFailure),
}

pub fn parse_line(raw: RawLogLine) -> ParseOutcome {
    let Some((timestamp_raw, payload)) = raw.raw_text.split_once("::") else {
        return ParseOutcome::Failed(ParseFailure {
            raw_line_id: raw.id,
            timestamp_raw: None,
            tokens: Vec::new(),
            error_code: ParseErrorCode::MissingTimestampSeparator,
            message: "Line does not contain the Neverwinter timestamp separator".to_string(),
        });
    };

    if payload.trim().is_empty() {
        return ParseOutcome::Failed(ParseFailure {
            raw_line_id: raw.id,
            timestamp_raw: Some(timestamp_raw.trim().to_string()),
            tokens: Vec::new(),
            error_code: ParseErrorCode::EmptyPayload,
            message: "Line contains a timestamp but no event payload".to_string(),
        });
    }

    let tokens = match tokenize_neverwinter_payload(payload) {
        Ok(tokens) => tokens,
        Err(error_code) => {
            return ParseOutcome::Failed(ParseFailure {
                raw_line_id: raw.id,
                timestamp_raw: Some(timestamp_raw.trim().to_string()),
                tokens: Vec::new(),
                error_code,
                message: "Line payload could not be tokenized".to_string(),
            });
        }
    };

    let amount1 = tokens.get(10).and_then(|token| parse_amount(token));
    let amount2 = tokens.get(11).and_then(|token| parse_amount(token));
    let flags = extract_flags(&tokens);
    let classification = classify_tokens(&tokens, amount1);

    ParseOutcome::Parsed(ParsedEvent {
        id: Uuid::new_v4(),
        raw_line_id: raw.id,
        timestamp_raw: timestamp_raw.trim().to_string(),
        timestamp_ms: None,
        owner_name: tokens.get(0).cloned().filter(|value| !value.is_empty()),
        owner_ref: tokens.get(1).cloned().filter(|value| !value.is_empty()),
        source_primary_name: tokens.get(2).cloned().filter(|value| !value.is_empty()),
        source_primary_ref: tokens.get(3).cloned().filter(|value| !value.is_empty()),
        target_primary_name: tokens.get(4).cloned().filter(|value| !value.is_empty()),
        target_primary_ref: tokens.get(5).cloned().filter(|value| !value.is_empty()),
        power_name: tokens.get(6).cloned().filter(|value| !value.is_empty()),
        power_ref: tokens.get(7).cloned().filter(|value| !value.is_empty()),
        event_type: tokens.get(8).cloned().filter(|value| !value.is_empty()),
        tokens,
        flags,
        amount1,
        amount2,
        classification,
        confidence: if classification == EventClassification::Unknown {
            0.2
        } else {
            0.75
        },
    })
}

pub fn tokenize_neverwinter_payload(payload: &str) -> Result<Vec<String>, ParseErrorCode> {
    const FIELD_COUNT: usize = 12;

    let tokens = tokenize_payload(payload)?;
    if tokens.len() == FIELD_COUNT {
        return Ok(tokens);
    }

    if tokens.len() > FIELD_COUNT {
        let legacy_comma_fix = payload.replace(", ", " ");
        let fixed_tokens = tokenize_payload(&legacy_comma_fix)?;
        if fixed_tokens.len() == FIELD_COUNT {
            return Ok(fixed_tokens);
        }
    }

    Err(ParseErrorCode::InvalidFieldCount)
}

pub fn tokenize_payload(payload: &str) -> Result<Vec<String>, ParseErrorCode> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut chars = payload.chars().peekable();
    let mut in_quotes = false;

    while let Some(ch) = chars.next() {
        match ch {
            '"' => {
                if in_quotes && chars.peek() == Some(&'"') {
                    current.push('"');
                    chars.next();
                } else {
                    in_quotes = !in_quotes;
                }
            }
            ',' if !in_quotes => {
                tokens.push(normalize_token(&current));
                current.clear();
            }
            _ => current.push(ch),
        }
    }

    if in_quotes {
        return Err(ParseErrorCode::UnterminatedQuote);
    }

    tokens.push(normalize_token(&current));
    Ok(tokens)
}

pub fn parse_amount(token: &str) -> Option<f64> {
    let trimmed = token.trim();
    if trimmed.is_empty() || trimmed == "*" {
        return None;
    }

    trimmed.parse::<f64>().ok()
}

fn normalize_token(token: &str) -> String {
    token.trim().trim_matches('\u{feff}').to_string()
}

fn extract_flags(tokens: &[String]) -> Vec<String> {
    tokens
        .get(9)
        .map(|flags| {
            flags
                .split('|')
                .map(str::trim)
                .filter(|flag| !flag.is_empty())
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn classify_tokens(tokens: &[String], amount: Option<f64>) -> EventClassification {
    let event_name = tokens
        .get(6)
        .map(|value| value.as_str())
        .unwrap_or_default();
    let event_ref = tokens
        .get(7)
        .map(|value| value.as_str())
        .unwrap_or_default();
    let damage_type = tokens
        .get(8)
        .map(|value| value.as_str())
        .unwrap_or_default();
    let flags = tokens
        .get(9)
        .map(|value| value.as_str())
        .unwrap_or_default();
    let joined = format!("{event_name} {event_ref} {damage_type} {flags}").to_ascii_lowercase();

    if joined.contains("fall") || joined.contains("injury") {
        return EventClassification::InjuryNoise;
    }
    if joined.contains("shield break") || joined.contains("shieldbreak") {
        return EventClassification::ShieldBreak;
    }
    if damage_type.eq_ignore_ascii_case("shield") {
        return EventClassification::ShieldDamage;
    }
    if joined.contains("cleanse") {
        return EventClassification::Cleanse;
    }
    if joined.contains("immune") || joined.contains("miss") || joined.contains("dodge") {
        return EventClassification::ImmuneResult;
    }
    if joined.contains("hold") || joined.contains("root") || joined.contains("control") {
        return EventClassification::ControlResult;
    }
    if damage_type.eq_ignore_ascii_case("hitpoints") && amount.unwrap_or_default() < 0.0 {
        return EventClassification::HealOut;
    }
    if damage_type.eq_ignore_ascii_case("power") || joined.contains("resource") {
        return EventClassification::PowerResource;
    }
    if amount.unwrap_or_default() > 0.0 {
        return EventClassification::DirectDamage;
    }

    EventClassification::Unknown
}
