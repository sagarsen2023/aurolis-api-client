use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio_util::sync::CancellationToken;
use unicode_normalization::UnicodeNormalization;

use crate::dialogs::pick_folder;
use crate::files::{
    AREAS, MANIFEST_PATH, WorkspaceFiles, read_workspace_files, workspace_pathspecs,
};
use crate::git::{
    changed_paths, normalize_clone_url, parse_github_remote, repo_name_from_url, same_remote,
};
use crate::github::sync::{is_owner, is_repo_name};
use crate::outcome::{AppResult, Failure, invalid};
use crate::paths::{is_inside, now_iso, resolve, to_posix, write_atomic};
use crate::registry::{Registry, Remote, WorkspaceEntry, valid_name};
use crate::secrets::WorkspaceSecrets;
use crate::state::AppState;

const SLUG_MAX_LENGTH: usize = 60;
const MAX_SCAN_DEPTH: usize = 3;
const MAX_MANIFEST_BYTES: usize = 1024 * 1024;
const SKIPPED_DIRS: [&str; 2] = [".git", "node_modules"];

static WINDOWS_RESERVED: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(con|prn|aux|nul|com[1-9]|lpt[1-9])$").unwrap());

static CLOUD_FOLDERS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    [
        r"(?i)[\\/]library[\\/]mobile documents([\\/]|$)",
        r"(?i)[\\/]library[\\/]cloudstorage([\\/]|$)",
        r"(?i)[\\/]icloud ?drive([\\/]|$)",
        r"(?i)[\\/]onedrive[^\\/]*([\\/]|$)",
        r"(?i)[\\/]dropbox([\\/]|$)",
        r"(?i)[\\/]google ?drive([\\/]|$)",
    ]
    .iter()
    .map(|pattern| Regex::new(pattern).unwrap())
    .collect()
});

pub fn slugify(name: &str, fallback: &str) -> String {
    let folded: String = name
        .nfkd()
        .filter(|ch| !('\u{300}'..='\u{36f}').contains(ch))
        .collect::<String>()
        .to_lowercase();
    let mut slug = String::new();
    let mut dash = false;
    for ch in folded.chars() {
        if ch.is_ascii_lowercase() || ch.is_ascii_digit() {
            slug.push(ch);
            dash = false;
        } else if !dash {
            slug.push('-');
            dash = true;
        }
    }
    let slug: String = slug
        .trim_matches('-')
        .chars()
        .take(SLUG_MAX_LENGTH)
        .collect();
    let slug = slug.trim_end_matches('-');
    let base = if slug.is_empty() { fallback } else { slug };
    if WINDOWS_RESERVED.is_match(base) {
        format!("{base}-{fallback}")
    } else {
        base.to_string()
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageFolderCheck {
    path: String,
    display_path: String,
    writable: bool,
    free_bytes: Option<u64>,
    warnings: Vec<&'static str>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListItem {
    #[serde(flatten)]
    entry: WorkspaceEntry,
    missing: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryView {
    storage_folder: Option<String>,
    storage_folder_display: Option<String>,
    default_storage_folder: StorageFolderCheck,
    active_workspace_id: Option<String>,
    workspaces: Vec<ListItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneResult {
    workspace_id: String,
    already_added: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitState {
    branch: Option<String>,
    changed_files: u64,
    unpushed_commits: u64,
    remote_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedRaw {
    entry: WorkspaceEntry,
    display_path: String,
    files: std::collections::BTreeMap<String, String>,
    oversized: Vec<String>,
    git: GitState,
    secrets: WorkspaceSecrets,
    secrets_persisted: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishResult {
    web_url: String,
    branch: String,
    committed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveCheck {
    managed: bool,
    changed_files: u64,
    unpushed_commits: u64,
    has_remote: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateParams {
    pub name: String,
    pub manifest: String,
    #[serde(default)]
    pub activate: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishParams {
    id: String,
    owner: String,
    repo: String,
    #[serde(default)]
    commit_changes: bool,
}

fn missing_folder(path: &Path, state: &AppState) -> Failure {
    Failure::new(
        "missing_folder",
        format!(
            "The folder {} was moved or deleted.",
            state.paths.display(path)
        ),
    )
}

fn validate_manifest(manifest: &str) -> AppResult<()> {
    let valid = manifest.len() <= MAX_MANIFEST_BYTES
        && serde_json::from_str::<serde_json::Value>(manifest).is_ok_and(|value| value.is_object());
    if valid {
        Ok(())
    } else {
        Err(invalid("The workspace manifest isn't valid."))
    }
}

fn nearest_existing(target: &Path) -> Option<PathBuf> {
    let mut current = target.to_path_buf();
    loop {
        if current.exists() {
            return Some(current);
        }
        if !current.pop() {
            return None;
        }
    }
}

fn inside_git_repository(target: &Path) -> bool {
    let mut current = nearest_existing(target).unwrap_or_else(|| target.to_path_buf());
    loop {
        if current.join(".git").exists() {
            return true;
        }
        if !current.pop() {
            return false;
        }
    }
}

fn writable(dir: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        let Ok(path) = std::ffi::CString::new(dir.as_os_str().as_bytes()) else {
            return false;
        };
        unsafe { libc::access(path.as_ptr(), libc::W_OK) == 0 }
    }
    #[cfg(not(unix))]
    {
        std::fs::metadata(dir).is_ok_and(|metadata| !metadata.permissions().readonly())
    }
}

pub fn check_storage_folder(state: &AppState, candidate: &Path) -> StorageFolderCheck {
    let target = resolve(candidate);
    let mut check = StorageFolderCheck {
        path: target.display().to_string(),
        display_path: state.paths.display(&target),
        writable: false,
        free_bytes: None,
        warnings: Vec::new(),
        error: None,
    };
    let user_data = &state.paths.user_data;
    if is_inside(&target, user_data) || is_inside(user_data, &target) {
        check.error = Some("Choose a folder outside Aurolis's own app data.".into());
        return check;
    }
    let Some(existing) = nearest_existing(&target) else {
        check.error = Some("This drive or folder isn't available.".into());
        return check;
    };
    check.writable = writable(&existing);
    if !check.writable {
        check.error = Some("Aurolis can't write to this folder.".into());
    }
    check.free_bytes = fs4::available_space(&existing).ok();
    let text = target.display().to_string();
    if CLOUD_FOLDERS.iter().any(|pattern| pattern.is_match(&text)) {
        check.warnings.push("cloud_synced");
    }
    if cfg!(windows) && text.starts_with("\\\\") {
        check.warnings.push("network_drive");
    }
    if inside_git_repository(&target) {
        check.warnings.push("inside_git_repo");
    }
    check
}

fn by_last_opened(entries: &[WorkspaceEntry]) -> Vec<WorkspaceEntry> {
    let mut sorted = entries.to_vec();
    sorted.sort_by(|a, b| b.last_opened_at.cmp(&a.last_opened_at));
    sorted
}

fn view_of(state: &AppState, registry: &Registry) -> RegistryView {
    RegistryView {
        storage_folder: registry.storage_folder.clone(),
        storage_folder_display: registry
            .storage_folder
            .as_ref()
            .map(|folder| state.paths.display(Path::new(folder))),
        default_storage_folder: check_storage_folder(state, &state.paths.default_storage_folder()),
        active_workspace_id: registry.active_workspace_id.clone(),
        workspaces: by_last_opened(&registry.workspaces)
            .into_iter()
            .map(|entry| ListItem {
                missing: !entry.repo_path().exists(),
                entry,
            })
            .collect(),
    }
}

pub async fn list(state: &AppState) -> AppResult<RegistryView> {
    let guard = state.registry.lock().await;
    let registry = guard.as_ref().expect("loaded");
    Ok(view_of(state, registry))
}

pub async fn find_entry(state: &AppState, id: &str) -> AppResult<WorkspaceEntry> {
    let guard = state.registry.lock().await;
    guard
        .as_ref()
        .expect("loaded")
        .workspaces
        .iter()
        .find(|entry| entry.id == id)
        .cloned()
        .ok_or_else(|| Failure::code("not_found"))
}

async fn update_registry<T>(
    state: &AppState,
    change: impl FnOnce(&mut Registry) -> AppResult<T>,
) -> AppResult<T> {
    let mut guard = state.registry.lock().await;
    let registry = guard.as_mut().expect("loaded");
    let result = change(registry)?;
    state.registry.save(registry).await?;
    Ok(result)
}

pub async fn choose_storage(
    app: &AppHandle,
    state: &AppState,
) -> AppResult<Option<StorageFolderCheck>> {
    let current = {
        let guard = state.registry.lock().await;
        guard.as_ref().expect("loaded").storage_folder.clone()
    };
    let start = current
        .map(PathBuf::from)
        .unwrap_or_else(|| state.paths.home.clone());
    let Some(picked) = pick_folder(app, "Choose where Aurolis stores workspaces", &start).await
    else {
        return Ok(None);
    };
    let picked = resolve(&picked);
    *state.chosen_storage.lock().await = Some(picked.clone());
    Ok(Some(check_storage_folder(state, &picked)))
}

pub async fn set_storage(state: &AppState, choice: &str) -> AppResult<RegistryView> {
    let target = match choice {
        "default" => Some(state.paths.default_storage_folder()),
        "chosen" => state.chosen_storage.lock().await.clone(),
        _ => None,
    };
    let Some(target) = target else {
        return Err(invalid("Choose a folder first."));
    };
    let check = check_storage_folder(state, &target);
    if check.error.is_some() || !check.writable {
        return Err(Failure::new(
            "storage_invalid",
            check.error.unwrap_or_default(),
        ));
    }
    tokio::fs::create_dir_all(&target).await?;
    let folder = target.display().to_string();
    update_registry(state, |registry| {
        registry.storage_folder = Some(folder);
        Ok(())
    })
    .await?;
    list(state).await
}

async fn require_storage_folder(state: &AppState) -> AppResult<PathBuf> {
    let folder = {
        let guard = state.registry.lock().await;
        guard.as_ref().expect("loaded").storage_folder.clone()
    };
    let Some(folder) = folder else {
        return Err(Failure::code("storage_not_set"));
    };
    let folder = PathBuf::from(folder);
    tokio::fs::create_dir_all(&folder).await?;
    Ok(folder)
}

fn unique_folder(parent: &Path, name: &str) -> PathBuf {
    let base = slugify(name, "workspace");
    let mut candidate = base.clone();
    let mut n = 2;
    while parent.join(&candidate).exists() {
        candidate = format!("{base}-{n}");
        n += 1;
    }
    parent.join(candidate)
}

async fn add_entry(state: &AppState, entry: WorkspaceEntry, activate: bool) -> AppResult<()> {
    tokio::fs::create_dir_all(state.paths.state_dir(&entry.id)).await?;
    update_registry(state, |registry| {
        if activate {
            registry.active_workspace_id = Some(entry.id.clone());
        }
        registry.workspaces.push(entry);
        Ok(())
    })
    .await
}

async fn commit_workspace_changes(
    state: &AppState,
    dir: &Path,
    root: &str,
    message: &str,
) -> AppResult<bool> {
    let entries = state
        .git
        .status_entries(dir, &workspace_pathspecs(root))
        .await?;
    if entries.is_empty() {
        return Ok(false);
    }
    state
        .git
        .commit_paths(dir, message, &changed_paths(&entries))
        .await?;
    Ok(true)
}

pub async fn create(state: &AppState, params: CreateParams) -> AppResult<String> {
    let name = valid_name(&params.name)?;
    validate_manifest(&params.manifest)?;
    let storage = require_storage_folder(state).await?;
    let repo_dir = unique_folder(&storage, &name);
    tokio::fs::create_dir_all(&repo_dir).await?;
    let setup = async {
        state.git.init_repository(&repo_dir).await?;
        state.git.configure_managed_repository(&repo_dir).await?;
        write_atomic(&repo_dir.join(MANIFEST_PATH), params.manifest.as_bytes()).await?;
        commit_workspace_changes(state, &repo_dir, "", "Create workspace").await?;
        AppResult::Ok(())
    };
    if let Err(error) = setup.await {
        let _ = tokio::fs::remove_dir_all(&repo_dir).await;
        return Err(error);
    }
    let id = uuid::Uuid::new_v4().to_string();
    add_entry(
        state,
        WorkspaceEntry {
            id: id.clone(),
            name,
            repo_dir: repo_dir.display().to_string(),
            root: String::new(),
            managed: true,
            remote: None,
            created_at: now_iso(),
            last_opened_at: now_iso(),
        },
        params.activate.unwrap_or(true),
    )
    .await?;
    Ok(id)
}

pub fn cancel_clones(state: &AppState) {
    if let Ok(mut clones) = state.clones.lock() {
        for (_, token) in clones.drain(..) {
            token.cancel();
        }
    }
}

fn find_workspace_root(repo_dir: &Path) -> String {
    if repo_dir.join(MANIFEST_PATH).exists() {
        return String::new();
    }
    let mut queue = std::collections::VecDeque::from([(repo_dir.to_path_buf(), 0usize)]);
    while let Some((dir, depth)) = queue.pop_front() {
        if depth >= MAX_SCAN_DEPTH {
            continue;
        }
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        let mut children: Vec<PathBuf> = entries
            .flatten()
            .filter(|entry| {
                entry.file_type().is_ok_and(|kind| kind.is_dir())
                    && !SKIPPED_DIRS.contains(&entry.file_name().to_string_lossy().as_ref())
            })
            .map(|entry| entry.path())
            .collect();
        children.sort();
        for child in children {
            if child.join(MANIFEST_PATH).exists() {
                return to_posix(child.strip_prefix(repo_dir).unwrap_or(&child));
            }
            queue.push_back((child, depth + 1));
        }
    }
    String::new()
}

async fn activate_existing(state: &AppState, id: String) -> AppResult<CloneResult> {
    let workspace_id = id.clone();
    update_registry(state, |registry| {
        registry.active_workspace_id = Some(id);
        Ok(())
    })
    .await?;
    Ok(CloneResult {
        workspace_id,
        already_added: true,
    })
}

pub async fn clone(state: &AppState, url: &str) -> AppResult<CloneResult> {
    let Some(url) = normalize_clone_url(url) else {
        return Err(Failure::new(
            "invalid_url",
            "Paste an https:// or SSH git URL, or a GitHub owner/repo.",
        ));
    };
    let existing = {
        let guard = state.registry.lock().await;
        guard
            .as_ref()
            .expect("loaded")
            .workspaces
            .iter()
            .find(|entry| {
                entry.root.is_empty()
                    && entry
                        .remote
                        .as_ref()
                        .is_some_and(|remote| same_remote(&remote.url, &url))
            })
            .map(|entry| entry.id.clone())
    };
    if let Some(id) = existing {
        return activate_existing(state, id).await;
    }
    let storage = require_storage_folder(state).await?;
    let repo_name = repo_name_from_url(&url);
    let repo_dir = unique_folder(&storage, &repo_name);
    let token = CancellationToken::new();
    let token_id = uuid::Uuid::new_v4();
    if let Ok(mut clones) = state.clones.lock() {
        clones.push((token_id, token.clone()));
    }
    let cloned = async {
        state
            .git
            .clone_repository(&url, &repo_dir, token.clone())
            .await?;
        state.git.configure_managed_repository(&repo_dir).await
    }
    .await;
    if let Ok(mut clones) = state.clones.lock() {
        clones.retain(|(id, _)| *id != token_id);
    }
    if let Err(error) = cloned {
        let _ = tokio::fs::remove_dir_all(&repo_dir).await;
        return Err(error);
    }
    let id = uuid::Uuid::new_v4().to_string();
    let root = find_workspace_root(&repo_dir);
    add_entry(
        state,
        WorkspaceEntry {
            id: id.clone(),
            name: repo_name,
            repo_dir: repo_dir.display().to_string(),
            root,
            managed: true,
            remote: Some(Remote {
                github: parse_github_remote(&url),
                url,
            }),
            created_at: now_iso(),
            last_opened_at: now_iso(),
        },
        true,
    )
    .await?;
    Ok(CloneResult {
        workspace_id: id,
        already_added: false,
    })
}

pub async fn open_folder(app: &AppHandle, state: &AppState) -> AppResult<CloneResult> {
    let Some(picked) = pick_folder(app, "Open a git repository", &state.paths.home).await else {
        return Err(Failure::code("cancelled"));
    };
    let picked = resolve(&picked);
    let Some(repo_dir) = state.git.top_level(&picked).await? else {
        return Err(Failure::new(
            "not_a_repository",
            "That folder isn't a git repository. Pick the folder you cloned.",
        ));
    };
    let picked_root = to_posix(picked.strip_prefix(&repo_dir).unwrap_or(Path::new("")));
    let root = if picked_root.is_empty() {
        find_workspace_root(&repo_dir)
    } else {
        picked_root
    };
    let existing = {
        let guard = state.registry.lock().await;
        guard
            .as_ref()
            .expect("loaded")
            .workspaces
            .iter()
            .find(|entry| resolve(entry.repo_path()) == repo_dir && entry.root == root)
            .map(|entry| entry.id.clone())
    };
    if let Some(id) = existing {
        return activate_existing(state, id).await;
    }
    let url = state.git.remote_url(&repo_dir).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let named = if root.is_empty() {
        repo_dir.clone()
    } else {
        repo_dir.join(&root)
    };
    let name = named
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "workspace".to_string());
    add_entry(
        state,
        WorkspaceEntry {
            id: id.clone(),
            name: valid_name(&name).unwrap_or_else(|_| "workspace".to_string()),
            repo_dir: repo_dir.display().to_string(),
            root,
            managed: false,
            remote: url.map(|url| Remote {
                github: parse_github_remote(&url),
                url,
            }),
            created_at: now_iso(),
            last_opened_at: now_iso(),
        },
        true,
    )
    .await?;
    Ok(CloneResult {
        workspace_id: id,
        already_added: false,
    })
}

pub async fn open(app: &AppHandle, state: &AppState, id: &str) -> AppResult<OpenedRaw> {
    let mut entry = find_entry(state, id).await?;
    let repo_dir = entry.repo_path().to_path_buf();
    if !repo_dir.exists() {
        return Err(missing_folder(&repo_dir, state));
    }
    let root_dir = entry.root_path();
    let WorkspaceFiles { files, oversized } = read_workspace_files(root_dir.clone()).await;
    let pathspecs = workspace_pathspecs(&entry.root);
    let (branch, changed_files, url) = tokio::try_join!(
        state.git.current_branch(&repo_dir),
        state.git.changed_file_count(&repo_dir, &pathspecs),
        state.git.remote_url(&repo_dir),
    )?;
    let unpushed_commits = if url.is_some() {
        state.git.unpushed_commit_count(&repo_dir).await?
    } else {
        0
    };
    entry.remote = url.clone().map(|url| Remote {
        github: parse_github_remote(&url),
        url,
    });
    entry.last_opened_at = now_iso();
    let updated = entry.clone();
    update_registry(state, |registry| {
        if let Some(stored) = registry
            .workspaces
            .iter_mut()
            .find(|candidate| candidate.id == updated.id)
        {
            stored.remote = updated.remote.clone();
            stored.last_opened_at = updated.last_opened_at.clone();
        }
        registry.active_workspace_id = Some(updated.id.clone());
        Ok(())
    })
    .await?;
    state
        .watcher
        .watch(app.clone(), &entry.id, &root_dir, &repo_dir, &AREAS);
    let secrets = state.secrets.get(&entry.id).await;
    Ok(OpenedRaw {
        display_path: state.paths.display(&root_dir),
        entry,
        files,
        oversized,
        git: GitState {
            branch,
            changed_files,
            unpushed_commits,
            remote_url: url,
        },
        secrets,
        secrets_persisted: state.secrets.persisted().await,
    })
}

pub async fn initialize(state: &AppState, id: &str, manifest: &str) -> AppResult<()> {
    validate_manifest(manifest)?;
    let entry = find_entry(state, id).await?;
    let file = entry.root_path().join(MANIFEST_PATH);
    if !file.exists() {
        write_atomic(&file, manifest.as_bytes()).await?;
    }
    Ok(())
}

pub async fn rename(state: &AppState, id: &str, name: &str) -> AppResult<RegistryView> {
    let name = valid_name(name)?;
    find_entry(state, id).await?;
    update_registry(state, |registry| {
        if let Some(entry) = registry.workspaces.iter_mut().find(|entry| entry.id == id) {
            entry.name = name;
        }
        Ok(())
    })
    .await?;
    list(state).await
}

pub async fn publish(state: &AppState, params: PublishParams) -> AppResult<PublishResult> {
    if !is_owner(&params.owner) || !is_repo_name(&params.repo) {
        return Err(invalid("Invalid repository name."));
    }
    let entry = find_entry(state, &params.id).await?;
    let dir = entry.repo_path().to_path_buf();
    if !dir.exists() {
        return Err(missing_folder(&dir, state));
    }
    let url = format!("https://github.com/{}/{}.git", params.owner, params.repo);
    let existing = state.git.remote_url(&dir).await?;
    if existing
        .as_ref()
        .is_some_and(|existing| !same_remote(existing, &url))
    {
        return Err(Failure::code("remote_exists"));
    }
    let Some(branch) = state.git.current_branch(&dir).await? else {
        return Err(Failure::code("detached_head"));
    };
    let committed = if params.commit_changes {
        let message = if state.git.has_commits(&dir).await? {
            "Update workspace"
        } else {
            "Create workspace"
        };
        commit_workspace_changes(state, &dir, &entry.root, message).await?
    } else {
        false
    };
    if !state.git.has_commits(&dir).await? {
        return Err(Failure::code("nothing_to_publish"));
    }
    if existing.is_none() {
        state.git.add_remote(&dir, &url).await?;
    }
    if let Err(error) = state.git.push_new_branch(&dir, &branch).await {
        if existing.is_none() {
            let _ = state.git.remove_remote(&dir).await;
        }
        return Err(error);
    }
    let github = crate::git::GithubRef {
        owner: params.owner.clone(),
        repo: params.repo.clone(),
    };
    let remote_url = url.clone();
    update_registry(state, |registry| {
        if let Some(stored) = registry
            .workspaces
            .iter_mut()
            .find(|candidate| candidate.id == entry.id)
        {
            stored.remote = Some(Remote {
                url: remote_url,
                github: Some(github),
            });
        }
        Ok(())
    })
    .await?;
    Ok(PublishResult {
        web_url: format!("https://github.com/{}/{}", params.owner, params.repo),
        branch,
        committed,
    })
}

pub async fn stop_sync(state: &AppState, id: &str) -> AppResult<()> {
    let entry = find_entry(state, id).await?;
    let dir = entry.repo_path().to_path_buf();
    if !dir.exists() {
        return Err(missing_folder(&dir, state));
    }
    state.git.remove_remote(&dir).await?;
    update_registry(state, |registry| {
        if let Some(stored) = registry
            .workspaces
            .iter_mut()
            .find(|candidate| candidate.id == id)
        {
            stored.remote = None;
        }
        Ok(())
    })
    .await
}

pub async fn reveal(state: &AppState, id: &str) -> AppResult<()> {
    let entry = find_entry(state, id).await?;
    if !entry.repo_path().exists() {
        return Err(Failure::code("missing_folder"));
    }
    tauri_plugin_opener::open_path(entry.root_path(), None::<&str>)
        .map_err(|error| Failure::new("unknown", error.to_string()))
}

pub async fn remove_check(state: &AppState, id: &str) -> AppResult<RemoveCheck> {
    let entry = find_entry(state, id).await?;
    let dir = entry.repo_path().to_path_buf();
    if !dir.exists() {
        return Ok(RemoveCheck {
            managed: entry.managed,
            changed_files: 0,
            unpushed_commits: 0,
            has_remote: entry.remote.is_some(),
        });
    }
    let everything = [".".to_string()];
    let (changed_files, unpushed_commits, url) = tokio::try_join!(
        state.git.changed_file_count(&dir, &everything),
        state.git.unpushed_commit_count(&dir),
        state.git.remote_url(&dir),
    )?;
    Ok(RemoveCheck {
        managed: entry.managed,
        changed_files,
        unpushed_commits,
        has_remote: url.is_some(),
    })
}

pub async fn remove(state: &AppState, id: &str, delete_folder: bool) -> AppResult<RegistryView> {
    let entry = find_entry(state, id).await?;
    if state.watcher.watching().as_deref() == Some(id) {
        state.watcher.stop();
    }
    let storage_folder = update_registry(state, |registry| {
        registry.workspaces.retain(|candidate| candidate.id != id);
        if registry.active_workspace_id.as_deref() == Some(id) {
            registry.active_workspace_id = by_last_opened(&registry.workspaces)
                .first()
                .map(|entry| entry.id.clone());
        }
        Ok(registry.storage_folder.clone())
    })
    .await?;
    let _ = tokio::fs::remove_dir_all(state.paths.state_dir(id)).await;
    state.secrets.forget(id).await;
    let repo_dir = resolve(entry.repo_path());
    let can_delete = delete_folder
        && entry.managed
        && repo_dir.join(".git").exists()
        && repo_dir != resolve(&state.paths.home)
        && storage_folder.is_none_or(|folder| repo_dir != resolve(Path::new(&folder)));
    if can_delete {
        tokio::fs::remove_dir_all(&repo_dir).await?;
    }
    list(state).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs_match_the_typescript_rules() {
        assert_eq!(slugify("Payments API", "workspace"), "payments-api");
        assert_eq!(slugify("  Café — Ünïcode  ", "workspace"), "cafe-unicode");
        assert_eq!(slugify("***", "workspace"), "workspace");
        assert_eq!(slugify("CON", "workspace"), "con-workspace");
        assert_eq!(slugify(&"a".repeat(80), "workspace").len(), 60);
        assert_eq!(
            slugify(&format!("{}-b", "a".repeat(59)), "workspace"),
            "a".repeat(59)
        );
    }
}
