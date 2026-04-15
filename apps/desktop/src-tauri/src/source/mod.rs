use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceKind {
    File,
    Folder,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceState {
    Missing,
    Ready,
    Watching,
    Warning,
    Disconnected,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SourceStatus {
    pub state: SourceState,
    pub path: Option<PathBuf>,
    pub message: String,
}

#[derive(Debug, Clone)]
pub struct TailState {
    pub path: PathBuf,
    pub last_read_offset: u64,
    pub partial_line: String,
}

impl TailState {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            last_read_offset: 0,
            partial_line: String::new(),
        }
    }
}

pub fn detect_latest_combat_log(folder: &Path) -> Option<PathBuf> {
    let entries = std::fs::read_dir(folder).ok()?;

    entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_string_lossy();
            if name.starts_with("Combat") && name.ends_with(".log") {
                let modified = entry
                    .metadata()
                    .and_then(|metadata| metadata.modified())
                    .ok()?;
                Some((path, modified))
            } else {
                None
            }
        })
        .max_by_key(|(_, modified)| *modified)
        .map(|(path, _)| path)
}
