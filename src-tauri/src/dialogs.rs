use std::path::{Path, PathBuf};

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

pub async fn pick_folder(app: &AppHandle, title: &str, directory: &Path) -> Option<PathBuf> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title(title)
        .set_directory(directory)
        .set_can_create_directories(true)
        .pick_folder(move |picked| {
            let _ = sender.send(picked);
        });
    receiver.await.ok()??.into_path().ok()
}

pub async fn save_file(
    app: &AppHandle,
    title: &str,
    directory: Option<&Path>,
    name: &str,
    filter: (&str, &str),
) -> Option<PathBuf> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let mut builder = app
        .dialog()
        .file()
        .set_title(title)
        .set_file_name(name)
        .add_filter(filter.0, &[filter.1]);
    if let Some(directory) = directory {
        builder = builder.set_directory(directory);
    }
    builder.save_file(move |picked| {
        let _ = sender.send(picked);
    });
    receiver.await.ok()??.into_path().ok()
}
