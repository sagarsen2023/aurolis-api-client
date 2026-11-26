import { WORKSPACE_ERROR_MESSAGES } from "@/constants/workspace";
import { desktopBridge } from "./config/desktop-bridge";
import type {
  PublishWorkspaceParams,
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
        info.code === "invalid_input" ||
        info.code === "sync_failed" ||
        info.code === "secret_leak");
    super(showDetail ? `${base} ${info.message}` : base);
    this.name = "WorkspaceFailure";
    this.code = info.code;
    this.detail = info.message;
  }
}

const bridge = () =>
  desktopBridge(
    "workspace",
    "Workspaces are only available in the desktop app.",
  );

export async function unwrapWorkspace<T>(
  result: Promise<WorkspaceResult<T>>,
): Promise<T> {
  const response = await result;
  if (!response.ok) throw new WorkspaceFailure(response.error);
  return response.data;
}

export const workspaceService = {
  list: () => unwrapWorkspace(bridge().list()),
  gitInfo: () => unwrapWorkspace(bridge().gitInfo()),
  chooseStorage: () => unwrapWorkspace(bridge().chooseStorage()),
  setStorage: (choice: "default" | "chosen") =>
    unwrapWorkspace(bridge().setStorage(choice)),
  create: (name: string) => unwrapWorkspace(bridge().create({ name })),
  clone: (url: string) => unwrapWorkspace(bridge().clone({ url })),
  cancelClone: () => unwrapWorkspace(bridge().cancelClone()),
  openFolder: () => unwrapWorkspace(bridge().openFolder()),
  open: (id: string) => unwrapWorkspace(bridge().open(id)),
  initialize: (id: string) => unwrapWorkspace(bridge().initialize(id)),
  rename: (id: string, name: string) =>
    unwrapWorkspace(bridge().rename({ id, name })),
  publish: (params: PublishWorkspaceParams) =>
    unwrapWorkspace(bridge().publish(params)),
  stopSync: (id: string) => unwrapWorkspace(bridge().stopSync(id)),
  removeCheck: (id: string) => unwrapWorkspace(bridge().removeCheck(id)),
  remove: (id: string, deleteFolder: boolean) =>
    unwrapWorkspace(bridge().remove({ id, deleteFolder })),
  reveal: (id: string) => unwrapWorkspace(bridge().reveal(id)),
  onChanged: (callback: (id: string) => void) =>
    window.aurolis?.workspace.onChanged(callback) ?? (() => undefined),
};
