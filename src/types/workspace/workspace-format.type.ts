import type { WorkspaceData } from "./workspace.type.ts";

export type WorkspaceFiles = Record<string, string>;

export interface FormatIssue {
  path: string;
  message: string;
}

export interface ParsedWorkspace {
  workspace: WorkspaceData;
  paths: Record<string, string>;
  issues: FormatIssue[];
}

export interface ToFilesOptions {
  previousPaths?: Record<string, string>;
}
