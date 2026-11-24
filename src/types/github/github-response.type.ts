import type { GithubApiErrorInfo } from "./github-error.type.ts";

/** Result of every GitHub call that crosses IPC. Errors are values, not throws. */
export type GithubResult<T> =
  { ok: true; data: T } | { ok: false; error: GithubApiErrorInfo };

export interface GithubInstallation {
  id: number;
  account: string;
  accountType: "User" | "Organization" | string;
  avatarUrl: string;
  /** "all" repositories of the account, or only "selected" ones. */
  repositorySelection: "all" | "selected" | string;
}

export interface GithubRepoPermissions {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  triage: boolean;
  pull: boolean;
}

export interface GithubRepository {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  /** The signed-in user's role on this repo, used for read-only vs. commit access. */
  permissions: GithubRepoPermissions;
}

export interface PulledFile {
  path: string;
  sha: string;
  content: string;
}

export interface PullFilesResponse {
  /** Branch head that was read; null when the repository is empty. */
  headSha: string | null;
  /** Files that are new or differ from knownFiles. */
  changed: PulledFile[];
  /** Paths in knownFiles that no longer exist on the branch. */
  deleted: string[];
  /** Every file under the requested path (path → blob sha), to store for the next pull. */
  files: Record<string, string>;
}

export interface CommitFilesResponse {
  /** New branch head. Equal to the old head when nothing changed. */
  commitSha: string;
  /** true when the changes matched what is already on GitHub, so no commit was made. */
  unchanged: boolean;
  /** Blob SHA of each written path (null for deleted ones), to merge into knownFiles. */
  files: Record<string, string | null>;
}
