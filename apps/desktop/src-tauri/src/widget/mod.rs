use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn open_widget_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("live-widget") {
        window.set_focus()?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app,
        "live-widget",
        WebviewUrl::App("/#/widget-runtime".into()),
    )
    .title("Nexus Combat Widget")
    .decorations(false)
    .always_on_top(true)
    .resizable(true)
    .inner_size(360.0, 240.0)
    .min_inner_size(260.0, 120.0)
    .build()?;

    Ok(())
}

pub fn close_widget_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("live-widget") {
        window.destroy()?;
    }

    Ok(())
}

pub fn is_widget_window_open(app: &AppHandle) -> bool {
    app.get_webview_window("live-widget").is_some()
}
