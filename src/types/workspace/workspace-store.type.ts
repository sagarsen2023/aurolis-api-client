import type { FormatIssue } from "./workspace-format.type.ts";
import type { WorkspaceData } from "./workspace.type.ts";

export interface WorkspaceRemote {
  url: string;
  github: { owner: string; repo: string } | null;
}

export interface WorkspaceEntry {
  id: string;
  name: string;
  repoDir: string;
  root: string;
  managed: boolean;
  remote: WorkspaceRemote | null;
  createdAt: string;
  lastOpenedAt: string;
}

export interface WorkspaceListItem extends WorkspaceEntry {
  missing: boolean;
}

export type StorageWarning =
  "cloud_synced" | "network_drive" | "inside_git_repo";

export interface StorageFolderCheck {
  path: string;
  displayPath: string;
  writable: boolean;
  freeBytes: number | null;
  warnings: StorageWarning[];
  error: string | null;
}

export interface WorkspaceRegistryView {
  storageFolder: string | null;
  storageFolderDisplay: string | null;
  defaultStorageFolder: StorageFolderCheck;
  activeWorkspaceId: string | null;
  workspaces: WorkspaceListItem[];
}

export interface WorkspaceGitState {
  branch: string | null;
  changedFiles: number;
  unpushedCommits: number;
  remoteUrl: string | null;
}

export interface OpenedWorkspace {
  entry: WorkspaceEntry;
  displayPath: string;
  isWorkspace: boolean;
  data: WorkspaceData | null;
  issues: FormatIssue[];
  git: WorkspaceGitState;
}

export interface RemoveCheck {
  managed: boolean;
  changedFiles: number;
  unpushedCommits: number;
  hasRemote: boolean;
}

export interface GitInfo {
  version: string;
  path: string;
}

export type WorkspaceErrorCode =
  | "storage_not_set"
  | "storage_invalid"
  | "not_found"
  | "missing_folder"
  | "invalid_input"
  | "invalid_url"
  | "not_a_repository"
  | "repository_not_found"
  | "folder_exists"
  | "auth_failed"
  | "network"
  | "locked"
  | "cancelled"
  | "remote_exists"
  | "nothing_to_publish"
  | "detached_head"
  | "git_unavailable"
  | "git_failed"
  | "not_a_workspace"
  | "newer_format"
  | "item_not_found"
  | "push_rejected"
  | "protected_branch"
  | "merge_conflict"
  | "nothing_to_commit"
  | "sync_failed"
  | "unknown";

export interface WorkspaceErrorInfo {
  code: WorkspaceErrorCode;
  message?: string;
}

export type WorkspaceResult<T> =
  { ok: true; data: T } | { ok: false; error: WorkspaceErrorInfo };

export interface CloneResult {
  workspaceId: string;
  alreadyAdded: boolean;
}

export interface CreateWorkspaceParams {
  name: string;
}

export interface CloneWorkspaceParams {
  url: string;
}

export interface RenameWorkspaceParams {
  id: string;
  name: string;
}

export interface PublishWorkspaceParams {
  id: string;
  owner: string;
  repo: string;
  commitChanges: boolean;
}

export interface PublishResult {
  webUrl: string;
  branch: string;
  committed: boolean;
}

export interface RemoveWorkspaceParams {
  id: string;
  deleteFolder: boolean;
}
