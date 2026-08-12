use super::*;

fn raw(text: &str) -> RawLogLine {
    RawLogLine {
        id: Uuid::new_v4(),
        log_file_id: None,
        line_index: 1,
        byte_offset: 0,
        raw_text: text.to_string(),
    }
}

#[test]
fn parses_timestamp_separator() {
    let outcome = parse_line(raw(
        "24:01:01:00:00:01.0::Player,P[1],Player,P[1],Boss,C[1],Strike,Pn.1,Physical,,100,120",
    ));

    match outcome {
        ParseOutcome::Parsed(event) => {
            assert_eq!(event.timestamp_raw, "24:01:01:00:00:01.0");
            assert_eq!(event.owner_name.as_deref(), Some("Player"));
            assert_eq!(event.source_primary_name.as_deref(), Some("Player"));
            assert_eq!(event.target_primary_name.as_deref(), Some("Boss"));
            assert_eq!(event.power_name.as_deref(), Some("Strike"));
            assert_eq!(event.amount1, Some(100.0));
            assert_eq!(event.amount2, Some(120.0));
            assert_eq!(event.classification, EventClassification::DirectDamage);
        }
        ParseOutcome::Failed(error) => panic!("unexpected parse error: {error:?}"),
    }
}

#[test]
fn tokenizes_quoted_commas() {
    let tokens = tokenize_payload(
        "Player,P[1],Player,P[1],Boss,C[1],\"Power, With Comma\",Pn.1,Physical,,100,120",
    )
    .unwrap();

    assert_eq!(tokens[6], "Power, With Comma");
}

#[test]
fn legacy_payload_requires_exact_neverwinter_field_count() {
    let outcome = parse_line(raw("24:01:01:00:00:01.0::Player,P[1],Boss,C[1],Strike"));

    match outcome {
        ParseOutcome::Failed(error) => {
            assert_eq!(error.error_code, ParseErrorCode::InvalidFieldCount);
        }
        ParseOutcome::Parsed(_) => panic!("short Neverwinter payload should fail"),
    }
}

#[test]
fn legacy_comma_space_name_fix_preserves_parse() {
    let outcome = parse_line(raw(
        "24:01:01:00:00:01.0::Player One,P[1],Player One,P[1],Boss, The,C[1],Strike,Pn.1,Physical,,100,120",
    ));

    match outcome {
        ParseOutcome::Parsed(event) => {
            assert_eq!(event.target_primary_name.as_deref(), Some("Boss The"));
            assert_eq!(event.amount1, Some(100.0));
        }
        ParseOutcome::Failed(error) => panic!("unexpected parse error: {error:?}"),
    }
}

#[test]
fn malformed_lines_are_failures_not_drops() {
    let outcome = parse_line(raw("Player,P[1],Boss,C[1],Strike"));

    match outcome {
        ParseOutcome::Failed(error) => {
            assert_eq!(error.error_code, ParseErrorCode::MissingTimestampSeparator);
        }
        ParseOutcome::Parsed(_) => panic!("malformed line should fail"),
    }
}

#[test]
fn parses_scientific_notation_amounts() {
    assert_eq!(parse_amount("1.25e3"), Some(1250.0));
}

#[test]
fn unknown_fallback_is_explicit() {
    let outcome = parse_line(raw(
        "24:01:01:00:00:01.0::*,*,*,*,*,*,Display,Pn.0,Meta,*,0,0",
    ));

    match outcome {
        ParseOutcome::Parsed(event) => {
            assert_eq!(event.classification, EventClassification::Unknown)
        }
        ParseOutcome::Failed(error) => panic!("unexpected parse error: {error:?}"),
    }
}
