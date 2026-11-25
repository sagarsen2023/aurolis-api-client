export type ChangeStatus =
  "added" | "modified" | "deleted" | "renamed" | "conflicted";

export type DiffLineKind = "hunk" | "add" | "delete" | "context";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface ChangedFile {
  path: string;
  oldPath: string | null;
  status: ChangeStatus;
  additions: number;
  deletions: number;
  binary: boolean;
  truncated: boolean;
  lines: DiffLine[];
}

export interface SourceControlChanges {
  branch: string | null;
  remoteUrl: string | null;
  unpushedCommits: number;
  files: ChangedFile[];
  truncatedFiles: number;
}

export interface CommitParams {
  workspaceId: string;
  message: string;
  sync: boolean;
}

export interface CommitResult {
  committed: boolean;
  pulled: boolean;
  pushed: boolean;
  branch: string | null;
}
