import type {
  CollectionOp,
  CollectionSettings,
  ExampleInput,
  FolderSettings,
  SavedRequest,
} from "@/types/workspace/collection-ops.type";
import type {
  EditorUiState,
  RequestDrafts,
} from "@/types/workspace/editor-state.type";
import type { RequestProtocol } from "@/types/workspace/request.type";
import type { WorkspaceResult } from "@/types/workspace/workspace-store.type";
import { WorkspaceFailure } from "./workspace.service";

function bridge() {
  const collection = window.aurolis?.collection;
  if (!collection) {
    throw new Error("Collections are only available in the desktop app.");
  }
  return collection;
}

async function unwrap<T>(result: Promise<WorkspaceResult<T>>): Promise<T> {
  const response = await result;
  if (!response.ok) throw new WorkspaceFailure(response.error);
  return response.data;
}

const apply = (workspaceId: string, op: CollectionOp) =>
  unwrap(bridge().apply({ workspaceId, op }));

export const collectionService = {
  apply,
  updateWorkspaceDescription: (workspaceId: string, description: string) =>
    apply(workspaceId, { op: "update-workspace", description }),
  createCollection: (workspaceId: string, name: string) =>
    apply(workspaceId, { op: "create-collection", name, description: "" }),
  updateCollection: (
    workspaceId: string,
    id: string,
    settings: CollectionSettings,
  ) => apply(workspaceId, { op: "update-collection", id, settings }),
  deleteCollection: (workspaceId: string, id: string) =>
    apply(workspaceId, { op: "delete-collection", id }),
  createFolder: (workspaceId: string, parentId: string, name: string) =>
    apply(workspaceId, { op: "create-folder", parentId, name }),
  updateFolder: (workspaceId: string, id: string, settings: FolderSettings) =>
    apply(workspaceId, { op: "update-folder", id, settings }),
  deleteFolder: (workspaceId: string, id: string) =>
    apply(workspaceId, { op: "delete-folder", id }),
  createRequest: (
    workspaceId: string,
    parentId: string,
    name: string,
    protocol: RequestProtocol,
  ) => apply(workspaceId, { op: "create-request", parentId, name, protocol }),
  saveRequest: (workspaceId: string, request: SavedRequest) =>
    apply(workspaceId, { op: "save-request", request }),
  duplicateRequest: (workspaceId: string, id: string) =>
    apply(workspaceId, { op: "duplicate-request", id }),
  deleteRequest: (workspaceId: string, id: string) =>
    apply(workspaceId, { op: "delete-request", id }),
  createExample: (
    workspaceId: string,
    requestId: string,
    example: ExampleInput,
  ) => apply(workspaceId, { op: "create-example", requestId, example }),
  updateExample: (workspaceId: string, id: string, example: ExampleInput) =>
    apply(workspaceId, { op: "update-example", id, example }),
  deleteExample: (workspaceId: string, id: string) =>
    apply(workspaceId, { op: "delete-example", id }),
  loadEditorState: (workspaceId: string) =>
    unwrap(bridge().loadEditorState(workspaceId)),
  saveDrafts: (workspaceId: string, drafts: RequestDrafts) =>
    unwrap(bridge().saveDrafts({ workspaceId, drafts })),
  saveUiState: (workspaceId: string, ui: EditorUiState) =>
    unwrap(bridge().saveUiState({ workspaceId, ui })),
};
