import type { CommitParams } from "@/types/workspace/source-control.type";
import type { WorkspaceResult } from "@/types/workspace/workspace-store.type";
import { WorkspaceFailure } from "./workspace.service";

function bridge() {
  const sourceControl = window.aurolis?.sourceControl;
  if (!sourceControl) {
    throw new Error("Source control is only available in the desktop app.");
  }
  return sourceControl;
}

async function unwrap<T>(result: Promise<WorkspaceResult<T>>): Promise<T> {
  const response = await result;
  if (!response.ok) throw new WorkspaceFailure(response.error);
  return response.data;
}

export const sourceControlService = {
  changes: (workspaceId: string) => unwrap(bridge().changes(workspaceId)),
  commit: (params: CommitParams) => unwrap(bridge().commit(params)),
};
