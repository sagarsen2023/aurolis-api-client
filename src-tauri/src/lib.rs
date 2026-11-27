mod assistants;
mod commands;
mod dialogs;
mod engines;
mod files;
mod git;
mod github;
mod outcome;
mod paths;
mod registry;
mod secrets;
mod source_control;
mod state;
mod transfer;
mod vault;
mod watcher;
mod workspace;

use std::path::PathBuf;

use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{Manager, WebviewWindowBuilder};

use crate::paths::AppPaths;
use crate::state::AppState;

fn platform() -> &'static str {
    match std::env::consts::OS {
        "macos" => "darwin",
        "windows" => "win32",
        other => other,
    }
}

fn is_app_url(url: &url::Url, dev_url: Option<&url::Url>) -> bool {
    match url.scheme() {
        "tauri" | "about" | "data" | "blob" => return true,
        _ => {}
    }
    if url.host_str() == Some("tauri.localhost") {
        return true;
    }
    dev_url.is_some_and(|dev| dev.origin() == url.origin())
}

fn open_external(url: &url::Url) {
    if matches!(url.scheme(), "http" | "https" | "mailto") {
        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
    }
}

fn app_paths(app: &tauri::App) -> tauri::Result<AppPaths> {
    let resolver = app.path();
    let user_data = match std::env::var_os("AUROLIS_DATA_DIR") {
        Some(dir) => PathBuf::from(dir),
        None => resolver.app_data_dir()?,
    };
    Ok(AppPaths {
        user_data,
        home: resolver.home_dir()?,
        downloads: resolver.download_dir().ok(),
    })
}

fn create_main_window(app: &tauri::App) -> tauri::Result<()> {
    let Some(config) = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .cloned()
    else {
        return Ok(());
    };
    let dev_url = app.config().build.dev_url.clone();
    let script = format!("window.__AUROLIS_PLATFORM__ = {:?};", platform());
    WebviewWindowBuilder::from_config(app.handle(), &config)?
        .initialization_script(script)
        .on_navigation(move |url| {
            if is_app_url(url, dev_url.as_ref()) {
                return true;
            }
            open_external(url);
            false
        })
        .on_new_window(|url, _features| {
            open_external(&url);
            NewWindowResponse::Deny
        })
        .on_page_load(|window, payload| {
            if payload.event() == PageLoadEvent::Finished {
                let _ = window.show();
            }
        })
        .build()?;
    Ok(())
}

pub fn run() {
    let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let paths = app_paths(app)?;
            std::fs::create_dir_all(&paths.user_data)?;
            let version = app.package_info().version.to_string();
            app.manage(AppState::new(paths, &version));
            create_main_window(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::github_start,
            commands::github_wait,
            commands::github_cancel,
            commands::github_status,
            commands::github_sign_out,
            commands::github_installations,
            commands::github_install_page,
            commands::github_repositories,
            commands::github_create_repository,
            commands::github_empty_repository,
            commands::workspace_list,
            commands::workspace_git_info,
            commands::workspace_storage_check_default,
            commands::workspace_storage_choose,
            commands::workspace_storage_set,
            commands::workspace_create,
            commands::workspace_clone,
            commands::workspace_clone_cancel,
            commands::workspace_open_folder,
            commands::workspace_open,
            commands::workspace_initialize,
            commands::workspace_rename,
            commands::workspace_publish,
            commands::workspace_stop_sync,
            commands::workspace_remove_check,
            commands::workspace_reveal,
            commands::workspace_remove,
            commands::workspace_read_files,
            commands::workspace_write_files,
            commands::workspace_state_read,
            commands::workspace_state_write,
            commands::secrets_get,
            commands::secrets_update,
            commands::source_control_changes,
            commands::source_control_commit,
            commands::source_control_pull,
            commands::source_control_branches,
            commands::source_control_switch_branch,
            commands::transfer_save_file,
            commands::engine_http_send,
            commands::engine_http_send_untracked,
            commands::engine_cancel,
            commands::engine_realtime_connect,
            commands::engine_realtime_send,
            commands::engine_realtime_disconnect,
            commands::engine_load_start,
            commands::engine_load_stop,
            commands::assistants_installed,
            commands::assistants_install,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aurolis");
}
