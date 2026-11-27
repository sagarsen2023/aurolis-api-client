use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::files::{read_workspace_files, workspace_pathspecs};
use crate::git::{StatusEntry, changed_paths};
use crate::outcome::{AppResult, Failure, invalid};
use crate::registry::WorkspaceEntry;
use crate::state::AppState;
use crate::workspace::find_entry;

const MAX_CONTENT_BYTES: usize = 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct ChangedFile {
    path: String,
    status: &'static str,
    content: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangesRaw {
    branch: Option<String>,
    remote_url: Option<String>,
    unpushed_commits: u64,
    file_count: usize,
    files: Vec<ChangedFile>,
    workspace_files: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitParams {
    workspace_id: String,
    message: String,
    sync: bool,
}

#[derive(Debug, Serialize)]
pub struct CommitResult {
    committed: bool,
    pulled: bool,
    pushed: bool,
    branch: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchList {
    current: Option<String>,
    local: Vec<String>,
    remote: Vec<String>,
    has_remote: bool,
    fetched: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchBranchParams {
    workspace_id: String,
    branch: String,
    create: bool,
}

#[derive(Debug, Serialize)]
pub struct SwitchBranchResult {
    branch: String,
    created: bool,
}

#[derive(Debug, Serialize)]
pub struct PullResult {
    status: &'static str,
    commits: u64,
    branch: Option<String>,
}

pub fn status_of(code: &str) -> &'static str {
    if code == "??" {
        return "added";
    }
    if code.contains('U') || code == "AA" || code == "DD" {
        return "conflicted";
    }
    if code.contains('D') {
        return "deleted";
    }
    if code.starts_with('A') {
        return "added";
    }
    "modified"
}

fn require_folder(entry: &WorkspaceEntry) -> AppResult<&Path> {
    let dir = entry.repo_path();
    if dir.exists() {
        Ok(dir)
    } else {
        Err(Failure::code("missing_folder"))
    }
}

fn relative_to_root(file: &str, root: &str) -> String {
    let prefix = format!("{root}/");
    if !root.is_empty() && file.starts_with(&prefix) {
        file[prefix.len()..].to_string()
    } else {
        file.to_string()
    }
}

async fn working_content(dir: &Path, repo_path: &str) -> Option<String> {
    let mut path = dir.to_path_buf();
    for part in repo_path.split('/') {
        path.push(part);
    }
    let content = tokio::fs::read_to_string(path).await.ok()?;
    (content.len() <= MAX_CONTENT_BYTES).then_some(content)
}

fn changed_files(entries: &[StatusEntry]) -> Vec<(String, &'static str)> {
    entries
        .iter()
        .flat_map(|entry| match &entry.old_path {
            None => vec![(entry.path.clone(), status_of(&entry.code))],
            Some(old) => vec![(old.clone(), "deleted"), (entry.path.clone(), "added")],
        })
        .collect()
}

pub async fn changes(state: &AppState, workspace_id: &str) -> AppResult<ChangesRaw> {
    let entry = find_entry(state, workspace_id).await?;
    let dir = require_folder(&entry)?.to_path_buf();
    let pathspecs = workspace_pathspecs(&entry.root);
    let (branch, url, entries, head_exists) = tokio::try_join!(
        state.git.current_branch(&dir),
        state.git.remote_url(&dir),
        state.git.status_entries(&dir, &pathspecs),
        state.git.has_commits(&dir),
    )?;
    let workspace = read_workspace_files(entry.root_path()).await;
    let mut files = Vec::new();
    for (repo_path, status) in changed_files(&entries) {
        let content = if status == "deleted" {
            state.git.show_head_file(&dir, &repo_path).await?
        } else {
            working_content(&dir, &repo_path).await
        };
        files.push(ChangedFile {
            path: relative_to_root(&repo_path, &entry.root),
            status,
            content,
        });
    }
    let unpushed_commits = if url.is_some() && head_exists {
        state.git.unpushed_commit_count(&dir).await?
    } else {
        0
    };
    Ok(ChangesRaw {
        branch,
        remote_url: url,
        unpushed_commits,
        file_count: entries.len(),
        files,
        workspace_files: workspace.files,
    })
}

async fn refuse_secret_leaks(
    state: &AppState,
    entry: &WorkspaceEntry,
    dir: &Path,
    changes: &[StatusEntry],
) -> AppResult<()> {
    let secrets = state.secrets.values(&entry.id).await;
    if secrets.is_empty() {
        return Ok(());
    }
    let mut leaks = Vec::new();
    for change in changes {
        if status_of(&change.code) == "deleted" {
            continue;
        }
        if let Some(content) = working_content(dir, &change.path).await
            && secrets
                .iter()
                .any(|secret| content.contains(secret.as_str()))
        {
            leaks.push(relative_to_root(&change.path, &entry.root));
        }
    }
    if leaks.is_empty() {
        return Ok(());
    }
    Err(Failure::new(
        "secret_leak",
        format!(
            "A secret value appears in {}. Replace it with its {{{{variable}}}} and save, then commit.",
            leaks.join(", ")
        ),
    ))
}

async fn bring_in_remote_changes(state: &AppState, dir: &Path, branch: &str) -> AppResult<u64> {
    state.git.fetch_origin(dir).await?;
    let tracking = state.git.has_upstream(dir).await?;
    let exists = tracking || state.git.remote_branch_exists(dir, branch).await?;
    if !exists {
        return Ok(0);
    }
    let reference = if tracking {
        "@{upstream}".to_string()
    } else {
        format!("refs/remotes/origin/{branch}")
    };
    let behind = state.git.commits_behind(dir, &reference).await?;
    if behind == 0 {
        return Ok(0);
    }
    state.git.merge_ref(dir, &reference).await?;
    Ok(behind)
}

fn sync_failure(error: Failure, committed: bool) -> Failure {
    let keeps_code =
        ["merge_conflict", "protected_branch", "push_rejected"].contains(&error.code.as_str());
    let git_codes = [
        "not_a_repository",
        "protected_branch",
        "push_rejected",
        "local_changes",
        "merge_conflict",
        "repository_not_found",
        "auth_failed",
        "network",
        "folder_exists",
        "locked",
        "git_failed",
    ];
    if !git_codes.contains(&error.code.as_str()) || keeps_code || !committed {
        return error;
    }
    Failure::new(
        "sync_failed",
        error.message.unwrap_or_default().trim().to_string(),
    )
}

pub async fn commit(state: &AppState, params: CommitParams) -> AppResult<CommitResult> {
    let message = params.message.trim().to_string();
    if message.is_empty() {
        return Err(invalid("Write a commit message."));
    }
    if message.chars().count() > 10_000 {
        return Err(invalid("Keep the commit message under 10,000 characters."));
    }
    if params.workspace_id.is_empty() || params.workspace_id.len() > 100 {
        return Err(invalid("Invalid workspace."));
    }
    let entry = find_entry(state, &params.workspace_id).await?;
    let dir = require_folder(&entry)?.to_path_buf();
    let Some(branch) = state.git.current_branch(&dir).await? else {
        return Err(Failure::code("detached_head"));
    };
    let changes = state
        .git
        .status_entries(&dir, &workspace_pathspecs(&entry.root))
        .await?;
    refuse_secret_leaks(state, &entry, &dir, &changes).await?;
    let committed = !changes.is_empty();
    if committed {
        state
            .git
            .commit_paths(&dir, &message, &changed_paths(&changes))
            .await?;
    }
    let url = state.git.remote_url(&dir).await?;
    if !params.sync || url.is_none() {
        if !committed {
            return Err(Failure::code("nothing_to_commit"));
        }
        return Ok(CommitResult {
            committed,
            pulled: false,
            pushed: false,
            branch,
        });
    }
    let synced = async {
        let pulled = bring_in_remote_changes(state, &dir, &branch).await? > 0;
        state.git.push_branch(&dir, &branch).await?;
        AppResult::Ok(pulled)
    }
    .await;
    match synced {
        Ok(pulled) => Ok(CommitResult {
            committed,
            pulled,
            pushed: true,
            branch,
        }),
        Err(error) => Err(sync_failure(error, committed)),
    }
}

pub async fn pull(state: &AppState, id: &str) -> AppResult<PullResult> {
    let entry = find_entry(state, id).await?;
    let dir = require_folder(&entry)?.to_path_buf();
    if state.git.remote_url(&dir).await?.is_none() {
        return Ok(PullResult {
            status: "local",
            commits: 0,
            branch: None,
        });
    }
    let Some(branch) = state.git.current_branch(&dir).await? else {
        return Err(Failure::code("detached_head"));
    };
    let commits = bring_in_remote_changes(state, &dir, &branch).await?;
    Ok(PullResult {
        status: if commits > 0 { "pulled" } else { "up-to-date" },
        commits,
        branch: Some(branch),
    })
}

fn check_workspace_id(id: &str) -> AppResult<()> {
    if id.is_empty() || id.len() > 100 {
        return Err(invalid("Invalid workspace."));
    }
    Ok(())
}

pub async fn branches(state: &AppState, id: &str, fetch: bool) -> AppResult<BranchList> {
    check_workspace_id(id)?;
    let entry = find_entry(state, id).await?;
    let dir = require_folder(&entry)?.to_path_buf();
    let has_remote = state.git.remote_url(&dir).await?.is_some();
    let fetched = has_remote && fetch && state.git.fetch_origin(&dir).await.is_ok();
    let refs = state.git.branch_refs(&dir).await?;
    let current = state.git.current_branch(&dir).await?;
    Ok(BranchList {
        current,
        local: refs.local,
        remote: if has_remote { refs.remote } else { Vec::new() },
        has_remote,
        fetched,
    })
}

pub async fn switch_branch(
    state: &AppState,
    params: SwitchBranchParams,
) -> AppResult<SwitchBranchResult> {
    check_workspace_id(&params.workspace_id)?;
    let branch = params.branch.trim().to_string();
    if branch.is_empty() {
        return Err(invalid("Enter a branch name."));
    }
    if branch.len() > 200 || branch.starts_with('-') {
        return Err(invalid("That isn't a valid branch name."));
    }
    let entry = find_entry(state, &params.workspace_id).await?;
    let dir = require_folder(&entry)?.to_path_buf();
    if !state.git.is_valid_branch_name(&dir, &branch).await? {
        return Err(invalid(format!("“{branch}” isn't a valid branch name.")));
    }
    if state.git.current_branch(&dir).await?.as_deref() == Some(branch.as_str()) {
        return Ok(SwitchBranchResult {
            branch,
            created: false,
        });
    }
    let pending = state
        .git
        .changed_file_count(&dir, &workspace_pathspecs(&entry.root))
        .await?;
    if pending > 0 {
        return Err(Failure::code("uncommitted_changes"));
    }
    let refs = state.git.branch_refs(&dir).await?;
    let local = refs.local.contains(&branch);
    let remote = refs.remote.contains(&branch);
    if params.create {
        if local || remote {
            return Err(Failure::code("branch_exists"));
        }
        state.git.create_branch(&dir, &branch).await?;
    } else if local {
        state.git.switch_branch(&dir, &branch).await?;
    } else if remote {
        state.git.switch_tracking_branch(&dir, &branch).await?;
    } else {
        return Err(Failure::code("branch_not_found"));
    }
    Ok(SwitchBranchResult {
        branch,
        created: params.create,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn statuses() {
        assert_eq!(status_of("??"), "added");
        assert_eq!(status_of("UU"), "conflicted");
        assert_eq!(status_of(" D"), "deleted");
        assert_eq!(status_of("A "), "added");
        assert_eq!(status_of(" M"), "modified");
        assert_eq!(
            relative_to_root("api/collections/a.json", "api"),
            "collections/a.json"
        );
        assert_eq!(
            relative_to_root("collections/a.json", ""),
            "collections/a.json"
        );
    }

    #[test]
    fn sync_failures_keep_merge_codes() {
        let conflict = sync_failure(Failure::new("merge_conflict", "x"), true);
        assert_eq!(conflict.code, "merge_conflict");
        let network = sync_failure(Failure::new("network", " offline "), true);
        assert_eq!(network.code, "sync_failed");
        assert_eq!(network.message.as_deref(), Some("offline"));
        let uncommitted = sync_failure(Failure::new("network", "offline"), false);
        assert_eq!(uncommitted.code, "network");
    }
}
