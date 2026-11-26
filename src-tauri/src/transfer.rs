use std::sync::LazyLock;

use regex::Regex;
use serde::Serialize;
use tauri::AppHandle;

use crate::dialogs::save_file;
use crate::outcome::{AppResult, invalid};
use crate::state::AppState;

const MAX_EXPORT_BYTES: usize = 200 * 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct SavedExportFile {
    saved: bool,
    path: Option<String>,
}

pub async fn save_export_file(
    app: &AppHandle,
    state: &AppState,
    name: &str,
    bytes: &[u8],
) -> AppResult<SavedExportFile> {
    static NAME: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r#"^[^/\\:*?"<>|\x00]+\.(json|zip)$"#).unwrap());
    if name.len() > 200 || !NAME.is_match(name) {
        return Err(invalid("Use a .json or .zip file name."));
    }
    if bytes.len() > MAX_EXPORT_BYTES {
        return Err(invalid("File too large."));
    }
    let extension = name.rsplit('.').next().unwrap_or("json");
    let filter = if extension == "zip" {
        ("Zip archive", "zip")
    } else {
        ("JSON", "json")
    };
    let directory = state.paths.downloads.clone();
    let Some(target) = save_file(app, "Export", directory.as_deref(), name, filter).await else {
        return Ok(SavedExportFile {
            saved: false,
            path: None,
        });
    };
    tokio::fs::write(&target, bytes).await?;
    Ok(SavedExportFile {
        saved: true,
        path: Some(target.display().to_string()),
    })
}
