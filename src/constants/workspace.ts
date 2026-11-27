import type {
  StorageWarning,
  WorkspaceErrorCode,
} from "@/types/workspace/workspace-store.type";

export const WORKSPACE_ERROR_MESSAGES: Record<WorkspaceErrorCode, string> = {
  storage_not_set: "Choose where Aurolis should store workspaces first.",
  storage_invalid: "Aurolis can't use that folder. Choose another one.",
  not_found: "That workspace no longer exists.",
  missing_folder: "This workspace's folder was moved or deleted.",
  invalid_input: "Check the details and try again.",
  invalid_url:
    "Paste an https:// or SSH git URL, or a GitHub repository like owner/repo.",
  not_a_repository:
    "That folder isn't a git repository. Pick the folder you cloned.",
  repository_not_found:
    "Repository not found. Check the URL, or install the Aurolis GitHub App on it if it's private.",
  folder_exists: "A folder with that name already exists.",
  auth_failed:
    "Git couldn't sign in to this repository. Sign in with GitHub again, or check your git credentials.",
  network:
    "Couldn't reach the git server. Check your connection and try again.",
  locked: "Another git command is running in this repository. Try again.",
  cancelled: "Cancelled.",
  remote_exists: "This workspace is already linked to a remote repository.",
  nothing_to_publish:
    "There's nothing to publish yet. Commit your changes first, then publish.",
  detached_head: "Check out a branch before publishing.",
  git_unavailable:
    "Aurolis needs Git 2.31 or newer. Install it from git-scm.com, then try again.",
  git_failed: "Git reported an error.",
  not_a_workspace:
    "This repository isn't an Aurolis workspace yet. Initialize it first.",
  newer_format:
    "This workspace was saved by a newer version of Aurolis. Update Aurolis to edit it.",
  push_rejected:
    "GitHub has newer commits on this branch. Sync again to bring them in first.",
  protected_branch:
    "This branch is protected on GitHub, so it can't be pushed to directly. Your commit is saved on this computer.",
  merge_conflict:
    "Your commit and the commits on GitHub change the same lines. Your commit is saved on this computer; the merge was stopped and nothing else changed. Resolve it in a terminal or editor, then sync again.",
  local_changes:
    "Some files you changed but haven't committed were also changed on the remote. Commit your changes, then sync again.",
  uncommitted_changes:
    "Commit or discard your changes before switching branches, so they stay on the branch you made them on.",
  branch_exists:
    "A branch with that name already exists. Switch to it instead.",
  branch_not_found:
    "That branch no longer exists. Refresh the list and try again.",
  nothing_to_commit: "There's nothing to commit.",
  secret_leak: "Nothing was committed.",
  sync_failed:
    "Committed on this computer, but syncing with the remote failed.",
  item_not_found:
    "That item no longer exists. It may have been changed outside Aurolis.",
  unknown: "Something went wrong. Try again.",
};

export const STORAGE_WARNING_MESSAGES: Record<StorageWarning, string> = {
  cloud_synced:
    "This folder is synced by a cloud service (iCloud Drive, OneDrive, Dropbox or Google Drive), which can corrupt git repositories.",
  network_drive:
    "This is a network drive. Git will be slow and changes may not be detected.",
  inside_git_repo:
    "This folder is inside another git repository, so workspaces would be nested in it.",
};

export const GITHUB_SUGGESTION_LIMIT = 6;

export const PULL_FAILURE_MESSAGES: Partial<
  Record<WorkspaceErrorCode, string>
> = {
  network:
    "Couldn't reach the remote, so you're seeing the copy on this computer.",
  auth_failed: "Sign in with GitHub to bring in the latest changes.",
  repository_not_found:
    "The remote repository wasn't found, or you don't have access to it.",
  local_changes:
    "Some changes you haven't committed touch files that changed on the remote. Commit them, then sync.",
  merge_conflict:
    "Your commits and the remote change the same lines, so nothing was pulled. Resolve it in your editor, then sync.",
  detached_head: "Check out a branch to pull the latest changes.",
};
