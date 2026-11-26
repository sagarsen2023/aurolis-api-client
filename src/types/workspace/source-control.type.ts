import type { HttpMethod, RequestProtocol } from "./request.type.ts";

export type ChangeStatus =
  "added" | "modified" | "deleted" | "renamed" | "conflicted";

export type ChangedItemKind =
  | "workspace"
  | "collection"
  | "folder"
  | "request"
  | "example"
  | "environment"
  | "globals"
  | "file";

export interface ChangedItem {
  key: string;
  kind: ChangedItemKind;
  name: string;
  previousName: string | null;
  status: ChangeStatus;
  location: string[];
  protocol: RequestProtocol | null;
  method: HttpMethod | null;
}

export type ChangeGroupKind = "collection" | "environments" | "workspace";

export interface ChangeGroup {
  key: string;
  kind: ChangeGroupKind;
  name: string;
  items: ChangedItem[];
}

export interface SourceControlChanges {
  branch: string | null;
  remoteUrl: string | null;
  unpushedCommits: number;
  fileCount: number;
  groups: ChangeGroup[];
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

export interface PullResult {
  status: "local" | "up-to-date" | "pulled";
  commits: number;
  branch: string | null;
}
