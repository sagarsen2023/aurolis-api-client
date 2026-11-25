import type { CollectionOp } from "@/types/workspace/collection-ops.type";
import type {
  EditorUiState,
  RequestDrafts,
} from "@/types/workspace/editor-state.type";
import { desktopBridge } from "./config/desktop-bridge";
import { unwrapWorkspace } from "./workspace.service";

const bridge = () =>
  desktopBridge(
    "collection",
    "Collections are only available in the desktop app.",
  );

export const collectionService = {
  apply: (workspaceId: string, op: CollectionOp) =>
    unwrapWorkspace(bridge().apply({ workspaceId, op })),
  loadEditorState: (workspaceId: string) =>
    unwrapWorkspace(bridge().loadEditorState(workspaceId)),
  saveDrafts: (workspaceId: string, drafts: RequestDrafts) =>
    unwrapWorkspace(bridge().saveDrafts({ workspaceId, drafts })),
  saveUiState: (workspaceId: string, ui: EditorUiState) =>
    unwrapWorkspace(bridge().saveUiState({ workspaceId, ui })),
};
