use crate::source::{SourceState, SourceStatus};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Default)]
pub struct AppRuntimeState {
    inner: Mutex<RuntimeSnapshot>,
}

#[derive(Debug)]
struct RuntimeSnapshot {
    source_status: SourceStatus,
    imported_logs: Vec<ImportedLog>,
    widget_open: bool,
    live_baseline_path: Option<PathBuf>,
    live_baseline_line_count: u64,
    live_history: Vec<LiveHistoryRecord>,
}

impl Default for RuntimeSnapshot {
    fn default() -> Self {
        Self {
            source_status: SourceStatus {
                state: SourceState::Missing,
                path: None,
                message: "No source selected".to_string(),
            },
            imported_logs: Vec::new(),
            widget_open: false,
            live_baseline_path: None,
            live_baseline_line_count: 0,
            live_history: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveHistoryRecord {
    pub id: String,
    pub title: String,
    pub source_path: PathBuf,
    pub line_count: u64,
    pub parsed_count: u64,
    pub failed_count: u64,
    pub total_damage: f64,
    pub party_damage: Vec<ImportedPartyDamage>,
    pub companion_damage: Vec<ImportedPartyDamage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedLog {
    pub path: PathBuf,
    pub name: String,
    pub size_bytes: u64,
    pub line_count: u64,
    pub parsed_count: u64,
    pub failed_count: u64,
    pub classification_counts: Vec<ImportedClassificationCount>,
    pub party_damage: Vec<ImportedPartyDamage>,
    pub companion_damage: Vec<ImportedPartyDamage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedClassificationCount {
    pub classification: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedPartyDamage {
    pub rank: u32,
    pub name: String,
    pub total_damage: f64,
    pub hit_count: u64,
    pub crit_count: u64,
    pub top_power: Option<String>,
    pub source_kind: String,
    pub owner_name: Option<String>,
    pub power_breakdown: Vec<ImportedPowerBreakdown>,
    pub damage_trend: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedPowerBreakdown {
    pub power_name: String,
    pub total_damage: f64,
    pub hit_count: u64,
}

impl AppRuntimeState {
    pub fn source_status(&self) -> SourceStatus {
        self.inner
            .lock()
            .expect("runtime state poisoned")
            .source_status
            .clone()
    }

    pub fn set_source_status(&self, source_status: SourceStatus) {
        let mut guard = self.inner.lock().expect("runtime state poisoned");
        if guard.source_status.path != source_status.path {
            guard.live_baseline_path = source_status.path.clone();
            guard.live_baseline_line_count = 0;
        }
        guard.source_status = source_status;
    }

    pub fn imported_logs(&self) -> Vec<ImportedLog> {
        self.inner
            .lock()
            .expect("runtime state poisoned")
            .imported_logs
            .clone()
    }

    pub fn add_imported_logs(&self, logs: Vec<ImportedLog>) -> Vec<ImportedLog> {
        let mut guard = self.inner.lock().expect("runtime state poisoned");

        for log in logs {
            if !guard
                .imported_logs
                .iter()
                .any(|existing| existing.path == log.path)
            {
                guard.imported_logs.push(log);
            }
        }

        guard.imported_logs.clone()
    }

    pub fn set_widget_open(&self, widget_open: bool) {
        self.inner
            .lock()
            .expect("runtime state poisoned")
            .widget_open = widget_open;
    }

    pub fn widget_open(&self) -> bool {
        self.inner
            .lock()
            .expect("runtime state poisoned")
            .widget_open
    }

    pub fn live_baseline_for(&self, path: &PathBuf) -> u64 {
        let guard = self.inner.lock().expect("runtime state poisoned");
        if guard.live_baseline_path.as_ref() == Some(path) {
            guard.live_baseline_line_count
        } else {
            0
        }
    }

    pub fn set_live_baseline(&self, path: PathBuf, line_count: u64) {
        let mut guard = self.inner.lock().expect("runtime state poisoned");
        guard.live_baseline_path = Some(path);
        guard.live_baseline_line_count = line_count;
    }

    pub fn live_history(&self) -> Vec<LiveHistoryRecord> {
        self.inner
            .lock()
            .expect("runtime state poisoned")
            .live_history
            .clone()
    }

    pub fn push_live_history(&self, record: LiveHistoryRecord) -> Vec<LiveHistoryRecord> {
        let mut guard = self.inner.lock().expect("runtime state poisoned");
        guard.live_history.insert(0, record);
        guard.live_history.truncate(20);
        guard.live_history.clone()
    }
}
