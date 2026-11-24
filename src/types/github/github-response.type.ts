import type { GithubApiErrorInfo } from "./github-error.type.ts";

export type GithubResult<T> =
  { ok: true; data: T } | { ok: false; error: GithubApiErrorInfo };

export interface GithubInstallation {
  id: number;
  account: string;
  accountType: "User" | "Organization" | string;
  avatarUrl: string;
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
  description: string | null;
  pushedAt: string | null;
  cloneUrl: string;
  permissions: GithubRepoPermissions;
}

export interface PulledFile {
  path: string;
  sha: string;
  content: string;
}

export interface PullFilesResponse {
  headSha: string | null;
  changed: PulledFile[];
  deleted: string[];
  files: Record<string, string>;
}

export interface CommitFilesResponse {
  commitSha: string;
  unchanged: boolean;
  files: Record<string, string | null>;
}
