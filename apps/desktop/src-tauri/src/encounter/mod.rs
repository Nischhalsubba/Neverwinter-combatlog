#[cfg(test)]
mod tests;

use crate::classification::EventClassification;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EncounterState {
    Idle,
    Pending,
    Active,
    CoolingDown,
    Closed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EncounterRules {
    pub inactivity_timeout_ms: i64,
    pub ignore_noise_starters: bool,
}

impl Default for EncounterRules {
    fn default() -> Self {
        Self {
            inactivity_timeout_ms: 10_000,
            ignore_noise_starters: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EncounterCandidate {
    pub id: Uuid,
    pub state: EncounterState,
    pub started_at_ms: Option<i64>,
    pub last_activity_ms: Option<i64>,
}

impl Default for EncounterCandidate {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            state: EncounterState::Idle,
            started_at_ms: None,
            last_activity_ms: None,
        }
    }
}

impl EncounterCandidate {
    pub fn apply_event(
        &mut self,
        timestamp_ms: i64,
        classification: EventClassification,
        rules: &EncounterRules,
    ) {
        let can_start = classification.is_meaningful_encounter_starter()
            || (!rules.ignore_noise_starters && classification != EventClassification::Unknown);

        match self.state {
            EncounterState::Idle if can_start => {
                self.state = EncounterState::Active;
                self.started_at_ms = Some(timestamp_ms);
                self.last_activity_ms = Some(timestamp_ms);
            }
            EncounterState::Active if classification.is_meaningful_encounter_starter() => {
                self.last_activity_ms = Some(timestamp_ms);
            }
            _ => {}
        }
    }

    pub fn tick(&mut self, now_ms: i64, rules: &EncounterRules) {
        if self.state == EncounterState::Active {
            if let Some(last_activity_ms) = self.last_activity_ms {
                if now_ms - last_activity_ms >= rules.inactivity_timeout_ms {
                    self.state = EncounterState::Closed;
                }
            }
        }
    }
}
