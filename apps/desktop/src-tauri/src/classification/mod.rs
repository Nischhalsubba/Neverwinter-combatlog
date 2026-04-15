use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EventClassification {
    DirectDamage,
    DotDamage,
    ShieldDamage,
    ShieldBreak,
    HealOut,
    HealIn,
    PowerResource,
    Cleanse,
    BuffApply,
    DebuffApply,
    ControlResult,
    ImmuneResult,
    SummonAction,
    EnvironmentHazard,
    MetaDisplay,
    InjuryNoise,
    Unknown,
}

impl EventClassification {
    pub fn is_meaningful_encounter_starter(self) -> bool {
        matches!(
            self,
            Self::DirectDamage
                | Self::DotDamage
                | Self::HealOut
                | Self::HealIn
                | Self::ControlResult
        )
    }
}
