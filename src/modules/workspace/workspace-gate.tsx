import type { ReactNode } from "react";
import { useAtomValue } from "jotai";
import { activeWorkspaceStateAtom } from "@/context/workspace-context";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";
import GetStarted from "./get-started";
import {
  MissingWorkspace,
  NotAWorkspace,
  WorkspaceLoadError,
} from "./workspace-states";

function WorkspaceGate({
  loading,
  children,
}: Readonly<{
  loading: ReactNode;
  children: (workspace: OpenedWorkspace) => ReactNode;
}>) {
  const state = useAtomValue(activeWorkspaceStateAtom);

  switch (state.status) {
    case "loading":
      return loading;
    case "none":
      return <GetStarted variant="page" />;
    case "missing":
      return (
        <MissingWorkspace
          workspaceId={state.workspaceId}
          message={state.message}
        />
      );
    case "error":
      return <WorkspaceLoadError message={state.message} />;
    case "ready":
      return state.workspace.isWorkspace ? (
        children(state.workspace)
      ) : (
        <NotAWorkspace workspace={state.workspace} />
      );
  }
}

export default WorkspaceGate;
