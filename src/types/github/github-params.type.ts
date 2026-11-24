export interface GithubRepoRef {
  owner: string;
  repo: string;
  branch: string;
}

export interface PullFilesParams extends GithubRepoRef {
  /** Only files under this folder, e.g. "" for the whole repo or "workspaces/acme". */
  path?: string;
  /** Blob SHAs the app already has (path → sha). Only files that differ are downloaded. */
  knownFiles?: Record<string, string>;
}

export interface FileChange {
  /** Repo-relative path, e.g. "collections/payments/create-payment.req.json". */
  path: string;
  /** New UTF-8 content, or null to delete the file. */
  content: string | null;
}

export interface CommitFilesParams extends GithubRepoRef {
  message: string;
  changes: FileChange[];
  /**
   * Head the changes were based on (from the last pull). If GitHub's branch has
   * moved since, nothing is written and a "conflict" error is returned.
   * null = the repository is expected to be empty. Omit to skip the check.
   */
  expectedHeadSha?: string | null;
}
