import type { SavedRequest } from "./collection-ops.type.ts";

export type EditorTab =
  | { kind: "request"; id: string }
  | { kind: "example"; id: string; requestId: string }
  | { kind: "collection"; id: string }
  | { kind: "folder"; id: string };

export type EditorTabKind = EditorTab["kind"];

export interface EditorUiState {
  tabs: EditorTab[];
  activeTabId: string | null;
}

export type RequestDrafts = Record<string, SavedRequest>;

export interface EditorState {
  drafts: RequestDrafts;
  ui: EditorUiState;
}

export interface SaveDraftsParams {
  workspaceId: string;
  drafts: RequestDrafts;
}

export interface SaveUiStateParams {
  workspaceId: string;
  ui: EditorUiState;
}
