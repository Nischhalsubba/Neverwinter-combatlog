use crate::engine::{
    count_log_lines, summarize_combat_log, ClassificationCount, CombatLogSummary, DamageRow,
    PowerBreakdown, RecentEvent,
};
use crate::runtime_state::{
    AppRuntimeState, ImportedClassificationCount, ImportedLog, ImportedPartyDamage,
    ImportedPowerBreakdown, LiveHistoryRecord,
};
use crate::source::{detect_latest_combat_log, SourceState, SourceStatus};
use crate::widget;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::State;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceStatusDto {
    pub state: String,
    pub path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedLogDto {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub line_count: u64,
    pub parsed_count: u64,
    pub failed_count: u64,
    pub classification_counts: Vec<ClassificationCountDto>,
    pub party_damage: Vec<PartyDamageDto>,
    pub companion_damage: Vec<PartyDamageDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveSourcePreviewDto {
    pub path: Option<String>,
    pub line_count: u64,
    pub parsed_count: u64,
    pub failed_count: u64,
    pub classification_counts: Vec<ClassificationCountDto>,
    pub party_damage: Vec<PartyDamageDto>,
    pub companion_damage: Vec<PartyDamageDto>,
    pub history: Vec<LiveHistoryRecordDto>,
    pub recent_events: Vec<RecentEventDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveHistoryRecordDto {
    pub id: String,
    pub title: String,
    pub source_path: String,
    pub line_count: u64,
    pub parsed_count: u64,
    pub failed_count: u64,
    pub total_damage: f64,
    pub party_damage: Vec<PartyDamageDto>,
    pub companion_damage: Vec<PartyDamageDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationCountDto {
    pub classification: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentEventDto {
    pub timestamp: Option<String>,
    pub classification: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartyDamageDto {
    pub rank: u32,
    pub name: String,
    pub total_damage: f64,
    pub hit_count: u64,
    pub crit_count: u64,
    pub crit_rate: f64,
    pub top_power: Option<String>,
    pub source_kind: String,
    pub owner_name: Option<String>,
    pub power_breakdown: Vec<PowerBreakdownDto>,
    pub damage_trend: Vec<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerBreakdownDto {
    pub power_name: String,
    pub total_damage: f64,
    pub hit_count: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetStatusDto {
    pub is_open: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveRankingRowDto {
    pub rank: u32,
    pub name: String,
    pub enc_dps: f64,
    pub total_damage: f64,
    pub boss_damage: f64,
    pub crit_rate: f64,
    pub deaths: u32,
}

#[tauri::command]
pub fn get_source_status(state: State<'_, AppRuntimeState>) -> SourceStatusDto {
    source_status_to_dto(state.source_status())
}

#[tauri::command]
pub fn choose_live_log_folder(
    state: State<'_, AppRuntimeState>,
) -> Result<SourceStatusDto, String> {
    let Some(folder) = rfd::FileDialog::new()
        .set_title("Choose Neverwinter log folder")
        .pick_folder()
    else {
        return Ok(source_status_to_dto(state.source_status()));
    };

    set_live_folder_path(&state, folder)
}

#[tauri::command]
pub fn choose_live_log_file(state: State<'_, AppRuntimeState>) -> Result<SourceStatusDto, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("Choose Neverwinter combat log")
        .add_filter("Combat logs", &["log"])
        .pick_file()
    else {
        return Ok(source_status_to_dto(state.source_status()));
    };

    set_live_file_path(&state, path)
}

#[tauri::command]
pub fn set_live_log_folder(
    path: String,
    state: State<'_, AppRuntimeState>,
) -> Result<SourceStatusDto, String> {
    set_live_folder_path(&state, PathBuf::from(path))
}

#[tauri::command]
pub fn set_live_log_file(
    path: String,
    state: State<'_, AppRuntimeState>,
) -> Result<SourceStatusDto, String> {
    set_live_file_path(&state, PathBuf::from(path))
}

#[tauri::command]
pub fn get_live_source_preview(
    state: State<'_, AppRuntimeState>,
) -> Result<LiveSourcePreviewDto, String> {
    let status = state.source_status();
    let Some(path) = status.path else {
        return Ok(empty_preview(None));
    };

    if !path.is_file() {
        return Ok(empty_preview(Some(path)));
    }

    let baseline = state.live_baseline_for(&path);
    let mut preview =
        summary_to_preview(summarize_combat_log(&path, baseline)?, Some(path.clone()));
    preview.history = live_history_to_dto(state.live_history());
    Ok(preview)
}

#[tauri::command]
pub fn reset_live_counter(
    state: State<'_, AppRuntimeState>,
) -> Result<LiveSourcePreviewDto, String> {
    let status = state.source_status();
    let Some(path) = status.path else {
        return Ok(empty_preview(None));
    };

    if !path.is_file() {
        return Ok(empty_preview(Some(path)));
    }

    let baseline = state.live_baseline_for(&path);
    let summary = summarize_combat_log(&path, baseline)?;
    if summary.line_count > 0 || summary.parsed_count > 0 || summary.failed_count > 0 {
        let total_damage = summary
            .party_damage
            .iter()
            .chain(summary.companion_damage.iter())
            .map(|row| row.total_damage)
            .sum();
        let record = LiveHistoryRecord {
            id: uuid::Uuid::new_v4().to_string(),
            title: format!("Session {}", state.live_history().len() + 1),
            source_path: path.clone(),
            line_count: summary.line_count,
            parsed_count: summary.parsed_count,
            failed_count: summary.failed_count,
            total_damage,
            party_damage: summary
                .party_damage
                .into_iter()
                .map(engine_damage_to_imported)
                .collect(),
            companion_damage: summary
                .companion_damage
                .into_iter()
                .map(engine_damage_to_imported)
                .collect(),
        };
        state.push_live_history(record);
    }

    let total_lines = count_log_lines(&path)?;
    state.set_live_baseline(path.clone(), total_lines);
    let mut preview = summary_to_preview(summarize_combat_log(&path, total_lines)?, Some(path));
    preview.history = live_history_to_dto(state.live_history());
    Ok(preview)
}

#[tauri::command]
pub fn get_imported_logs(state: State<'_, AppRuntimeState>) -> Vec<ImportedLogDto> {
    state
        .imported_logs()
        .into_iter()
        .map(imported_log_to_dto)
        .collect()
}

#[tauri::command]
pub fn import_log_files(state: State<'_, AppRuntimeState>) -> Result<Vec<ImportedLogDto>, String> {
    let Some(paths) = rfd::FileDialog::new()
        .set_title("Import recorded combat logs")
        .add_filter("Combat logs", &["log"])
        .pick_files()
    else {
        return Ok(state
            .imported_logs()
            .into_iter()
            .map(imported_log_to_dto)
            .collect());
    };

    import_paths(&state, paths)
}

#[tauri::command]
pub fn import_log_file_paths(
    paths: Vec<String>,
    state: State<'_, AppRuntimeState>,
) -> Result<Vec<ImportedLogDto>, String> {
    import_paths(&state, paths.into_iter().map(PathBuf::from).collect())
}

fn import_paths(
    state: &State<'_, AppRuntimeState>,
    paths: Vec<PathBuf>,
) -> Result<Vec<ImportedLogDto>, String> {
    let logs = paths
        .into_iter()
        .filter(|path| path.is_file())
        .map(read_imported_log)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(state
        .add_imported_logs(logs)
        .into_iter()
        .map(imported_log_to_dto)
        .collect())
}

#[tauri::command]
pub fn get_live_rankings() -> Vec<LiveRankingRowDto> {
    Vec::new()
}

#[tauri::command]
pub fn get_widget_status(
    app: tauri::AppHandle,
    state: State<'_, AppRuntimeState>,
) -> WidgetStatusDto {
    let _ = widget::close_widget_window(&app);
    WidgetStatusDto {
        is_open: state.widget_open(),
    }
}

#[tauri::command]
pub fn open_widget_window(
    _app: tauri::AppHandle,
    state: State<'_, AppRuntimeState>,
) -> Result<WidgetStatusDto, String> {
    state.set_widget_open(true);
    Ok(WidgetStatusDto { is_open: true })
}

#[tauri::command]
pub fn close_widget_window(
    app: tauri::AppHandle,
    state: State<'_, AppRuntimeState>,
) -> Result<WidgetStatusDto, String> {
    widget::close_widget_window(&app).map_err(|error| error.to_string())?;
    state.set_widget_open(false);
    Ok(WidgetStatusDto { is_open: false })
}

#[tauri::command]
pub fn toggle_widget_window(
    app: tauri::AppHandle,
    state: State<'_, AppRuntimeState>,
) -> Result<WidgetStatusDto, String> {
    if state.widget_open() {
        close_widget_window(app, state)
    } else {
        open_widget_window(app, state)
    }
}

fn source_status_to_dto(status: SourceStatus) -> SourceStatusDto {
    SourceStatusDto {
        state: match status.state {
            SourceState::Missing => "missing",
            SourceState::Ready => "ready",
            SourceState::Watching => "watching",
            SourceState::Warning => "warning",
            SourceState::Disconnected => "disconnected",
        }
        .to_string(),
        path: status.path.map(|path| path.display().to_string()),
        message: status.message,
    }
}

fn set_live_folder_path(
    state: &State<'_, AppRuntimeState>,
    folder: PathBuf,
) -> Result<SourceStatusDto, String> {
    let status = match detect_latest_combat_log(&folder) {
        Some(path) => SourceStatus {
            state: SourceState::Watching,
            message: format!("Watching latest combat log: {}", file_label(&path)),
            path: Some(path),
        },
        None => SourceStatus {
            state: SourceState::Warning,
            message: "No Combat*.log file found in the selected folder".to_string(),
            path: Some(folder),
        },
    };

    state.set_source_status(status.clone());
    Ok(source_status_to_dto(status))
}

fn set_live_file_path(
    state: &State<'_, AppRuntimeState>,
    path: PathBuf,
) -> Result<SourceStatusDto, String> {
    let status = if path.is_file() {
        SourceStatus {
            state: SourceState::Watching,
            message: format!("Watching combat log: {}", file_label(&path)),
            path: Some(path),
        }
    } else {
        SourceStatus {
            state: SourceState::Warning,
            message: "Selected combat log file could not be found".to_string(),
            path: Some(path),
        }
    };

    state.set_source_status(status.clone());
    Ok(source_status_to_dto(status))
}

fn imported_log_to_dto(log: ImportedLog) -> ImportedLogDto {
    ImportedLogDto {
        path: log.path.display().to_string(),
        name: log.name,
        size_bytes: log.size_bytes,
        line_count: log.line_count,
        parsed_count: log.parsed_count,
        failed_count: log.failed_count,
        classification_counts: log
            .classification_counts
            .into_iter()
            .map(|item| ClassificationCountDto {
                classification: item.classification,
                count: item.count,
            })
            .collect(),
        party_damage: log
            .party_damage
            .into_iter()
            .map(imported_party_damage_to_dto)
            .collect(),
        companion_damage: log
            .companion_damage
            .into_iter()
            .map(imported_party_damage_to_dto)
            .collect(),
    }
}

fn read_imported_log(path: PathBuf) -> Result<ImportedLog, String> {
    let metadata = std::fs::metadata(&path).map_err(|error| error.to_string())?;
    let summary = summarize_combat_log(&path, 0)?;

    Ok(ImportedLog {
        name: file_label(&path),
        path,
        size_bytes: metadata.len(),
        line_count: summary.line_count,
        parsed_count: summary.parsed_count,
        failed_count: summary.failed_count,
        classification_counts: summary
            .classification_counts
            .into_iter()
            .map(engine_classification_to_imported)
            .collect(),
        party_damage: summary
            .party_damage
            .into_iter()
            .map(engine_damage_to_imported)
            .collect(),
        companion_damage: summary
            .companion_damage
            .into_iter()
            .map(engine_damage_to_imported)
            .collect(),
    })
}

fn empty_preview(path: Option<PathBuf>) -> LiveSourcePreviewDto {
    LiveSourcePreviewDto {
        path: path.map(|path| path.display().to_string()),
        line_count: 0,
        parsed_count: 0,
        failed_count: 0,
        classification_counts: Vec::new(),
        party_damage: Vec::new(),
        companion_damage: Vec::new(),
        history: Vec::new(),
        recent_events: Vec::new(),
    }
}

fn summary_to_preview(summary: CombatLogSummary, path: Option<PathBuf>) -> LiveSourcePreviewDto {
    LiveSourcePreviewDto {
        path: path.map(|path| path.display().to_string()),
        line_count: summary.line_count,
        parsed_count: summary.parsed_count,
        failed_count: summary.failed_count,
        classification_counts: summary
            .classification_counts
            .into_iter()
            .map(engine_classification_to_dto)
            .collect(),
        party_damage: summary
            .party_damage
            .into_iter()
            .map(engine_damage_to_dto)
            .collect(),
        companion_damage: summary
            .companion_damage
            .into_iter()
            .map(engine_damage_to_dto)
            .collect(),
        history: Vec::new(),
        recent_events: summary
            .recent_events
            .into_iter()
            .map(engine_recent_event_to_dto)
            .collect(),
    }
}

fn engine_classification_to_dto(item: ClassificationCount) -> ClassificationCountDto {
    ClassificationCountDto {
        classification: item.classification,
        count: item.count,
    }
}

fn engine_classification_to_imported(item: ClassificationCount) -> ImportedClassificationCount {
    ImportedClassificationCount {
        classification: item.classification,
        count: item.count,
    }
}

fn engine_recent_event_to_dto(event: RecentEvent) -> RecentEventDto {
    RecentEventDto {
        timestamp: event.timestamp,
        classification: event.classification,
        summary: event.summary,
    }
}

fn engine_damage_to_dto(row: DamageRow) -> PartyDamageDto {
    PartyDamageDto {
        rank: row.rank,
        name: row.name,
        total_damage: row.total_damage,
        hit_count: row.hit_count,
        crit_count: row.crit_count,
        crit_rate: row.crit_rate,
        top_power: row.top_power,
        source_kind: row.source_kind,
        owner_name: row.owner_name,
        power_breakdown: row
            .power_breakdown
            .into_iter()
            .map(engine_power_to_dto)
            .collect(),
        damage_trend: row.damage_trend,
    }
}

fn engine_damage_to_imported(row: DamageRow) -> ImportedPartyDamage {
    ImportedPartyDamage {
        rank: row.rank,
        name: row.name,
        total_damage: row.total_damage,
        hit_count: row.hit_count,
        crit_count: row.crit_count,
        top_power: row.top_power,
        source_kind: row.source_kind,
        owner_name: row.owner_name,
        power_breakdown: row
            .power_breakdown
            .into_iter()
            .map(engine_power_to_imported)
            .collect(),
        damage_trend: row.damage_trend,
    }
}

fn engine_power_to_dto(power: PowerBreakdown) -> PowerBreakdownDto {
    PowerBreakdownDto {
        power_name: power.power_name,
        total_damage: power.total_damage,
        hit_count: power.hit_count,
    }
}

fn engine_power_to_imported(power: PowerBreakdown) -> ImportedPowerBreakdown {
    ImportedPowerBreakdown {
        power_name: power.power_name,
        total_damage: power.total_damage,
        hit_count: power.hit_count,
    }
}

fn imported_party_damage_to_dto(row: ImportedPartyDamage) -> PartyDamageDto {
    PartyDamageDto {
        rank: row.rank,
        name: row.name,
        total_damage: row.total_damage,
        hit_count: row.hit_count,
        crit_count: row.crit_count,
        crit_rate: if row.hit_count == 0 {
            0.0
        } else {
            row.crit_count as f64 / row.hit_count as f64
        },
        top_power: row.top_power,
        source_kind: row.source_kind,
        owner_name: row.owner_name,
        power_breakdown: row
            .power_breakdown
            .into_iter()
            .map(|power| PowerBreakdownDto {
                power_name: power.power_name,
                total_damage: power.total_damage,
                hit_count: power.hit_count,
            })
            .collect(),
        damage_trend: row.damage_trend,
    }
}

fn dto_to_imported_party_damage(row: PartyDamageDto) -> ImportedPartyDamage {
    ImportedPartyDamage {
        rank: row.rank,
        name: row.name,
        total_damage: row.total_damage,
        hit_count: row.hit_count,
        crit_count: row.crit_count,
        top_power: row.top_power,
        source_kind: row.source_kind,
        owner_name: row.owner_name,
        power_breakdown: row
            .power_breakdown
            .into_iter()
            .map(|power| ImportedPowerBreakdown {
                power_name: power.power_name,
                total_damage: power.total_damage,
                hit_count: power.hit_count,
            })
            .collect(),
        damage_trend: row.damage_trend,
    }
}

fn live_history_to_dto(history: Vec<LiveHistoryRecord>) -> Vec<LiveHistoryRecordDto> {
    history
        .into_iter()
        .map(|record| LiveHistoryRecordDto {
            id: record.id,
            title: record.title,
            source_path: record.source_path.display().to_string(),
            line_count: record.line_count,
            parsed_count: record.parsed_count,
            failed_count: record.failed_count,
            total_damage: record.total_damage,
            party_damage: record
                .party_damage
                .into_iter()
                .map(imported_party_damage_to_dto)
                .collect(),
            companion_damage: record
                .companion_damage
                .into_iter()
                .map(imported_party_damage_to_dto)
                .collect(),
        })
        .collect()
}

fn file_label(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("selected log")
        .to_string()
}
