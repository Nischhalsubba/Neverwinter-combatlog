use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SubjectMetrics {
    pub total_damage: f64,
    pub boss_damage: f64,
    pub damage_taken: f64,
    pub heals_done: f64,
    pub heals_received: f64,
    pub deaths: u32,
    pub crit_hits: u32,
    pub total_hits: u32,
    pub shield_absorbed: f64,
    pub shield_break_count: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct EncounterMetrics {
    pub encounter_id: Option<Uuid>,
    pub by_subject: HashMap<Uuid, SubjectMetrics>,
}

impl SubjectMetrics {
    pub fn enc_dps(&self, duration_seconds: f64) -> f64 {
        if duration_seconds <= 0.0 {
            0.0
        } else {
            self.total_damage / duration_seconds
        }
    }

    pub fn crit_rate(&self) -> f64 {
        if self.total_hits == 0 {
            0.0
        } else {
            self.crit_hits as f64 / self.total_hits as f64
        }
    }
}
