import { WORKSPACE_ERROR_MESSAGES } from "@/constants/workspace";
import type {
  WorkspaceErrorCode,
  WorkspaceErrorInfo,
  WorkspaceResult,
} from "@/types/workspace/workspace-store.type";

export class WorkspaceFailure extends Error {
  readonly code: WorkspaceErrorCode;
  readonly detail: string | undefined;

  constructor(info: WorkspaceErrorInfo) {
    const base =
      WORKSPACE_ERROR_MESSAGES[info.code] ?? WORKSPACE_ERROR_MESSAGES.unknown;
    const showDetail =
      info.message &&
      (info.code === "git_failed" ||
        info.code === "unknown" ||
        info.code === "missing_folder" ||
        info.code === "storage_invalid" ||
        info.code === "invalid_input");
    super(showDetail ? `${base} ${info.message}` : base);
    this.name = "WorkspaceFailure";
    this.code = info.code;
    this.detail = info.message;
  }
}

function bridge() {
  const workspace = window.aurolis?.workspace;
  if (!workspace) {
    throw new Error("Workspaces are only available in the desktop app.");
  }
  return workspace;
}

async function unwrap<T>(result: Promise<WorkspaceResult<T>>): Promise<T> {
  const response = await result;
  if (!response.ok) throw new WorkspaceFailure(response.error);
  return response.data;
}

export const workspaceService = {
  list: () => unwrap(bridge().list()),
  gitInfo: () => unwrap(bridge().gitInfo()),
  chooseStorage: () => unwrap(bridge().chooseStorage()),
  setStorage: (choice: "default" | "chosen") =>
    unwrap(bridge().setStorage(choice)),
  create: (name: string) => unwrap(bridge().create({ name })),
  clone: (url: string) => unwrap(bridge().clone({ url })),
  cancelClone: () => unwrap(bridge().cancelClone()),
  openFolder: () => unwrap(bridge().openFolder()),
  open: (id: string) => unwrap(bridge().open(id)),
  initialize: (id: string) => unwrap(bridge().initialize(id)),
  rename: (id: string, name: string) => unwrap(bridge().rename({ id, name })),
  removeCheck: (id: string) => unwrap(bridge().removeCheck(id)),
  remove: (id: string, deleteFolder: boolean) =>
    unwrap(bridge().remove({ id, deleteFolder })),
  reveal: (id: string) => unwrap(bridge().reveal(id)),
  onChanged: (callback: (id: string) => void) =>
    window.aurolis?.workspace.onChanged(callback) ?? (() => undefined),
};
