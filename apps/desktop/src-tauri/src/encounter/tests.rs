use super::*;

#[test]
fn meaningful_damage_starts_encounter() {
    let rules = EncounterRules::default();
    let mut encounter = EncounterCandidate::default();

    encounter.apply_event(1000, EventClassification::DirectDamage, &rules);

    assert_eq!(encounter.state, EncounterState::Active);
    assert_eq!(encounter.started_at_ms, Some(1000));
}

#[test]
fn injury_noise_does_not_start_by_default() {
    let rules = EncounterRules::default();
    let mut encounter = EncounterCandidate::default();

    encounter.apply_event(1000, EventClassification::InjuryNoise, &rules);

    assert_eq!(encounter.state, EncounterState::Idle);
}

#[test]
fn inactivity_closes_active_encounter() {
    let rules = EncounterRules {
        inactivity_timeout_ms: 5000,
        ignore_noise_starters: true,
    };
    let mut encounter = EncounterCandidate::default();

    encounter.apply_event(1000, EventClassification::DirectDamage, &rules);
    encounter.tick(6000, &rules);

    assert_eq!(encounter.state, EncounterState::Closed);
}
