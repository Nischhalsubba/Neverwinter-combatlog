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

    let tokens = match tokenize_payload(payload) {
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

    let numeric_values: Vec<f64> = tokens
        .iter()
        .filter_map(|token| parse_amount(token))
        .collect();
    let amount1 = numeric_values.last().copied();
    let amount2 = numeric_values.iter().rev().nth(1).copied();
    let flags = extract_flags(&tokens);
    let classification = classify_tokens(&tokens, amount1);

    ParseOutcome::Parsed(ParsedEvent {
        id: Uuid::new_v4(),
        raw_line_id: raw.id,
        timestamp_raw: timestamp_raw.trim().to_string(),
        timestamp_ms: None,
        source_primary_name: tokens.get(0).cloned().filter(|value| !value.is_empty()),
        source_primary_ref: tokens.get(1).cloned().filter(|value| !value.is_empty()),
        target_primary_name: tokens.get(2).cloned().filter(|value| !value.is_empty()),
        target_primary_ref: tokens.get(3).cloned().filter(|value| !value.is_empty()),
        power_name: tokens.get(4).cloned().filter(|value| !value.is_empty()),
        power_ref: tokens.get(5).cloned().filter(|value| !value.is_empty()),
        event_type: tokens.get(6).cloned().filter(|value| !value.is_empty()),
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
    const KNOWN_FLAGS: &[&str] = &[
        "Critical", "Flank", "Deflect", "Dodge", "Immune", "Miss", "Shield", "Cleanse",
    ];

    tokens
        .iter()
        .filter(|token| {
            KNOWN_FLAGS
                .iter()
                .any(|flag| token.eq_ignore_ascii_case(flag))
        })
        .cloned()
        .collect()
}

fn classify_tokens(tokens: &[String], amount: Option<f64>) -> EventClassification {
    let joined = tokens.join(" ").to_ascii_lowercase();

    if joined.contains("fall") || joined.contains("injury") {
        return EventClassification::InjuryNoise;
    }
    if joined.contains("shield break") || joined.contains("shieldbreak") {
        return EventClassification::ShieldBreak;
    }
    if joined.contains("shield") && amount.unwrap_or_default() > 0.0 {
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
    if joined.contains("heal") {
        return EventClassification::HealOut;
    }
    if joined.contains("power") || joined.contains("resource") {
        return EventClassification::PowerResource;
    }
    if amount.unwrap_or_default() > 0.0 {
        return EventClassification::DirectDamage;
    }

    EventClassification::Unknown
}
