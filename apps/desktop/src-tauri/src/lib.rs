mod classification;
mod commands;
mod encounter;
mod engine;
mod entities;
mod metrics;
mod parser;
mod runtime_state;
mod source;
mod storage;
mod widget;

pub fn run() {
    tauri::Builder::default()
        .manage(runtime_state::AppRuntimeState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_source_status,
            commands::choose_live_log_folder,
            commands::choose_live_log_file,
            commands::set_live_log_folder,
            commands::set_live_log_file,
            commands::get_live_source_preview,
            commands::reset_live_counter,
            commands::get_imported_logs,
            commands::import_log_files,
            commands::import_log_file_paths,
            commands::get_live_rankings,
            commands::get_widget_status,
            commands::open_widget_window,
            commands::close_widget_window,
            commands::toggle_widget_window
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Nexus Combat Analyzer");
}
