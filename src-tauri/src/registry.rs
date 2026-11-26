use std::path::Path;

use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, MutexGuard};

use crate::git::GithubRef;
use crate::outcome::{AppResult, Failure};
use crate::paths::{AppPaths, write_atomic};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Remote {
    pub url: String,
    pub github: Option<GithubRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    pub id: String,
    pub name: String,
    pub repo_dir: String,
    pub root: String,
    pub managed: bool,
    pub remote: Option<Remote>,
    pub created_at: String,
    pub last_opened_at: String,
}

impl WorkspaceEntry {
    pub fn repo_path(&self) -> &Path {
        Path::new(&self.repo_dir)
    }

    pub fn root_path(&self) -> std::path::PathBuf {
        let mut path = self.repo_path().to_path_buf();
        for part in self.root.split('/').filter(|part| !part.is_empty()) {
            path.push(part);
        }
        path
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Registry {
    pub version: u8,
    pub storage_folder: Option<String>,
    pub active_workspace_id: Option<String>,
    pub workspaces: Vec<WorkspaceEntry>,
}

impl Default for Registry {
    fn default() -> Self {
        Self {
            version: 1,
            storage_folder: None,
            active_workspace_id: None,
            workspaces: Vec::new(),
        }
    }
}

pub fn valid_name(name: &str) -> AppResult<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(Failure::new("invalid_input", "Enter a name"));
    }
    if trimmed.chars().count() > 100 {
        return Err(Failure::new("invalid_input", "Use 100 characters or fewer"));
    }
    Ok(trimmed.to_string())
}

fn is_valid(registry: &Registry) -> bool {
    registry.version == 1
        && registry.workspaces.iter().all(|entry| {
            uuid::Uuid::parse_str(&entry.id).is_ok()
                && valid_name(&entry.name).is_ok()
                && !entry.repo_dir.is_empty()
        })
}

pub fn stable_json(value: &impl Serialize) -> AppResult<String> {
    let value =
        serde_json::to_value(value).map_err(|error| Failure::new("unknown", error.to_string()))?;
    let text = serde_json::to_string_pretty(&value)
        .map_err(|error| Failure::new("unknown", error.to_string()))?;
    Ok(format!("{text}\n"))
}

pub struct RegistryStore {
    paths: AppPaths,
    current: Mutex<Option<Registry>>,
}

impl RegistryStore {
    pub fn new(paths: AppPaths) -> Self {
        Self {
            paths,
            current: Mutex::new(None),
        }
    }

    async fn set_aside(&self) {
        let file = self.paths.registry_file();
        let aside = file.with_extension(format!(
            "json.unreadable-{}",
            chrono::Utc::now().timestamp_millis()
        ));
        let _ = tokio::fs::rename(&file, aside).await;
    }

    async fn load(&self) -> Registry {
        match tokio::fs::read_to_string(self.paths.registry_file()).await {
            Ok(raw) => match serde_json::from_str::<Registry>(&raw) {
                Ok(registry) if is_valid(&registry) => return registry,
                _ => self.set_aside().await,
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => self.set_aside().await,
        }
        Registry::default()
    }

    pub async fn lock(&self) -> MutexGuard<'_, Option<Registry>> {
        let mut guard = self.current.lock().await;
        if guard.is_none() {
            *guard = Some(self.load().await);
        }
        guard
    }

    pub async fn save(&self, registry: &Registry) -> AppResult<()> {
        let text = stable_json(registry)?;
        write_atomic(&self.paths.registry_file(), text.as_bytes()).await
    }
}
