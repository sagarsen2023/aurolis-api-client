use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;

use tokio::sync::Mutex;

use crate::outcome::{AppResult, invalid};
use crate::paths::{AppPaths, write_atomic};
use crate::vault::Vault;

pub type EnvironmentSecrets = BTreeMap<String, String>;
pub type WorkspaceSecrets = BTreeMap<String, EnvironmentSecrets>;

const SECRETS_FILE: &str = "secrets.bin";
const MIN_LEAK_LENGTH: usize = 4;
const MAX_ENVIRONMENTS: usize = 1_000;
const MAX_KEYS: usize = 1_000;
const MAX_ID_LENGTH: usize = 200;
const MAX_KEY_LENGTH: usize = 1_000;
const MAX_TOTAL_BYTES: usize = 5 * 1024 * 1024;

pub struct SecretStore {
    paths: AppPaths,
    vault: Arc<Vault>,
    cache: Mutex<HashMap<String, WorkspaceSecrets>>,
}

impl SecretStore {
    pub fn new(paths: AppPaths, vault: Arc<Vault>) -> Self {
        Self {
            paths,
            vault,
            cache: Mutex::new(HashMap::new()),
        }
    }

    pub async fn persisted(&self) -> bool {
        self.vault.available().await
    }

    async fn read(&self, workspace_id: &str) -> WorkspaceSecrets {
        let file = self.paths.state_file(workspace_id, SECRETS_FILE);
        let Ok(sealed) = tokio::fs::read_to_string(&file).await else {
            return WorkspaceSecrets::new();
        };
        let Some(plain) = self.vault.open(&sealed).await else {
            return WorkspaceSecrets::new();
        };
        serde_json::from_slice(&plain).unwrap_or_default()
    }

    pub async fn get(&self, workspace_id: &str) -> WorkspaceSecrets {
        if let Some(cached) = self.cache.lock().await.get(workspace_id) {
            return cached.clone();
        }
        let secrets = self.read(workspace_id).await;
        self.cache
            .lock()
            .await
            .insert(workspace_id.to_string(), secrets.clone());
        secrets
    }

    pub async fn update(
        &self,
        workspace_id: &str,
        set: WorkspaceSecrets,
        remove: Vec<String>,
    ) -> AppResult<()> {
        validate(&set, &remove)?;
        let mut next = self.get(workspace_id).await;
        for id in remove {
            next.remove(&id);
        }
        for (id, values) in set {
            next.insert(id, values);
        }
        let encoded = serde_json::to_vec(&next).map_err(|error| invalid(error.to_string()))?;
        if encoded.len() > MAX_TOTAL_BYTES {
            return Err(invalid("Too many secret values."));
        }
        self.cache
            .lock()
            .await
            .insert(workspace_id.to_string(), next);
        if let Some(sealed) = self.vault.seal(&encoded).await {
            write_atomic(
                &self.paths.state_file(workspace_id, SECRETS_FILE),
                sealed.as_bytes(),
            )
            .await?;
        }
        Ok(())
    }

    pub async fn forget(&self, workspace_id: &str) {
        self.cache.lock().await.remove(workspace_id);
    }

    pub async fn values(&self, workspace_id: &str) -> Vec<String> {
        self.get(workspace_id)
            .await
            .into_values()
            .flat_map(|environment| environment.into_values())
            .filter(|value| value.chars().count() >= MIN_LEAK_LENGTH)
            .collect()
    }
}

fn validate(set: &WorkspaceSecrets, remove: &[String]) -> AppResult<()> {
    if set.len() > MAX_ENVIRONMENTS || remove.len() > MAX_ENVIRONMENTS {
        return Err(invalid("Too many environments."));
    }
    let bad_id = |id: &String| id.is_empty() || id.len() > MAX_ID_LENGTH;
    if set.keys().any(bad_id) || remove.iter().any(bad_id) {
        return Err(invalid("Invalid environment id."));
    }
    for values in set.values() {
        if values.len() > MAX_KEYS {
            return Err(invalid("Too many secret values."));
        }
        if values
            .keys()
            .any(|key| key.is_empty() || key.len() > MAX_KEY_LENGTH)
        {
            return Err(invalid("Invalid secret name."));
        }
    }
    Ok(())
}
