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
        "24:01:01:00:00:01.0::Player,P[1],Boss,C[1],Strike,Pn.1,Physical,100",
    ));

    match outcome {
        ParseOutcome::Parsed(event) => {
            assert_eq!(event.timestamp_raw, "24:01:01:00:00:01.0");
            assert_eq!(event.classification, EventClassification::DirectDamage);
        }
        ParseOutcome::Failed(error) => panic!("unexpected parse error: {error:?}"),
    }
}

#[test]
fn tokenizes_quoted_commas() {
    let tokens =
        tokenize_payload("Player,P[1],Boss,C[1],\"Power, With Comma\",Pn.1,Physical,100").unwrap();

    assert_eq!(tokens[4], "Power, With Comma");
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
    let outcome = parse_line(raw("24:01:01:00:00:01.0::*,*,*,*,Display,Pn.0,Meta,*"));

    match outcome {
        ParseOutcome::Parsed(event) => {
            assert_eq!(event.classification, EventClassification::Unknown)
        }
        ParseOutcome::Failed(error) => panic!("unexpected parse error: {error:?}"),
    }
}
