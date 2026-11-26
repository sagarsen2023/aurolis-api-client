use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode, Watcher as _};
use tauri::{AppHandle, Emitter};

pub const WORKSPACE_CHANGED_EVENT: &str = "aurolis:workspace-changed";
const DEBOUNCE: Duration = Duration::from_millis(400);

struct Active {
    id: String,
    _watcher: RecommendedWatcher,
    task: tauri::async_runtime::JoinHandle<()>,
}

#[derive(Default)]
pub struct WorkspaceWatcher {
    active: Mutex<Option<Active>>,
}

impl WorkspaceWatcher {
    pub fn watching(&self) -> Option<String> {
        self.active
            .lock()
            .ok()
            .and_then(|active| active.as_ref().map(|active| active.id.clone()))
    }

    pub fn stop(&self) {
        if let Ok(mut active) = self.active.lock()
            && let Some(previous) = active.take()
        {
            previous.task.abort();
        }
    }

    pub fn watch(&self, app: AppHandle, id: &str, root: &Path, repo_dir: &Path, areas: &[&str]) {
        if self.watching().as_deref() == Some(id) {
            return;
        }
        self.stop();
        let (sender, mut receiver) = tokio::sync::mpsc::unbounded_channel::<()>();
        let Ok(mut watcher) =
            notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
                if event.is_ok() {
                    let _ = sender.send(());
                }
            })
        else {
            return;
        };
        let git_dir = repo_dir.join(".git");
        let mut targets: Vec<(PathBuf, RecursiveMode)> =
            vec![(root.to_path_buf(), RecursiveMode::NonRecursive)];
        targets.extend(
            areas
                .iter()
                .map(|area| (root.join(area), RecursiveMode::Recursive)),
        );
        targets.push((git_dir.clone(), RecursiveMode::NonRecursive));
        targets.push((git_dir.join("refs"), RecursiveMode::Recursive));
        for (target, mode) in targets {
            if target.exists() {
                let _ = watcher.watch(&target, mode);
            }
        }
        let workspace_id = id.to_string();
        let task = tauri::async_runtime::spawn(async move {
            while receiver.recv().await.is_some() {
                loop {
                    tokio::select! {
                        more = receiver.recv() => {
                            if more.is_none() {
                                return;
                            }
                        }
                        _ = tokio::time::sleep(DEBOUNCE) => break,
                    }
                }
                let _ = app.emit(WORKSPACE_CHANGED_EVENT, workspace_id.clone());
            }
        });
        if let Ok(mut active) = self.active.lock() {
            *active = Some(Active {
                id: id.to_string(),
                _watcher: watcher,
                task,
            });
        }
    }
}
