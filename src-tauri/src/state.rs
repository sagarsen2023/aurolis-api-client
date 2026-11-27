use std::path::PathBuf;
use std::sync::Arc;

use tokio_util::sync::CancellationToken;

use crate::engines::http::HttpEngine;
use crate::engines::load::LoadEngine;
use crate::engines::realtime::RealtimeEngine;
use crate::git::Git;
use crate::github::api::GithubApi;
use crate::github::auth::GithubAuth;
use crate::paths::AppPaths;
use crate::registry::RegistryStore;
use crate::secrets::SecretStore;
use crate::vault::Vault;
use crate::watcher::WorkspaceWatcher;

pub struct AppState {
    pub paths: AppPaths,
    pub secrets: SecretStore,
    pub auth: Arc<GithubAuth>,
    pub github: GithubApi,
    pub git: Git,
    pub registry: RegistryStore,
    pub watcher: WorkspaceWatcher,
    pub chosen_storage: tokio::sync::Mutex<Option<PathBuf>>,
    pub clones: std::sync::Mutex<Vec<(uuid::Uuid, CancellationToken)>>,
    pub http: HttpEngine,
    pub realtime: RealtimeEngine,
    pub load: LoadEngine,
}

pub fn tls_config() -> Arc<rustls::ClientConfig> {
    use rustls_platform_verifier::ConfigVerifierExt;
    let config = rustls::ClientConfig::with_platform_verifier().unwrap_or_else(|_| {
        rustls::ClientConfig::builder()
            .with_root_certificates(rustls::RootCertStore::empty())
            .with_no_client_auth()
    });
    Arc::new(config)
}

impl AppState {
    pub fn new(paths: AppPaths, version: &str) -> Self {
        let user_agent = format!("Aurolis/{version}");
        let http = reqwest::Client::builder()
            .user_agent(user_agent.clone())
            .build()
            .expect("http client");
        let vault = Arc::new(Vault::new());
        let auth = Arc::new(GithubAuth::new(http.clone(), paths.clone(), vault.clone()));
        Self {
            secrets: SecretStore::new(paths.clone(), vault),
            github: GithubApi::new(http, auth.clone()),
            git: Git::new(auth.clone()),
            registry: RegistryStore::new(paths.clone()),
            watcher: WorkspaceWatcher::default(),
            chosen_storage: tokio::sync::Mutex::new(None),
            clones: std::sync::Mutex::new(Vec::new()),
            http: HttpEngine::new(&user_agent),
            realtime: RealtimeEngine::new(tls_config()),
            load: LoadEngine::default(),
            auth,
            paths,
        }
    }
}
