use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EntityType {
    Player,
    Boss,
    Npc,
    Pet,
    Summon,
    ArtifactEntity,
    Environment,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EntityRecord {
    pub id: Uuid,
    pub reference: Option<String>,
    pub display_name: String,
    pub clean_name: String,
    pub entity_type: EntityType,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OwnerLink {
    pub entity_id: Uuid,
    pub owner_entity_id: Uuid,
    pub confidence: f32,
    pub strategy: String,
}

pub fn clean_npc_identity(name: &str) -> String {
    name.trim()
        .trim_matches('*')
        .split(" [")
        .next()
        .unwrap_or(name)
        .trim()
        .to_string()
}
