export interface GithubRepoRef {
  owner: string;
  repo: string;
  branch: string;
}

export interface PullFilesParams extends GithubRepoRef {
  path?: string;
  knownFiles?: Record<string, string>;
}

export interface FileChange {
  path: string;
  content: string | null;
}

export interface CommitFilesParams extends GithubRepoRef {
  message: string;
  changes: FileChange[];
  expectedHeadSha?: string | null;
}
