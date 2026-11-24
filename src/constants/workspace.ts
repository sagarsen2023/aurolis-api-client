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
