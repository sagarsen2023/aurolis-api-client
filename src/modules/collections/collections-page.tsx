import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Skeleton } from "@/components/ui/skeleton";
import { editorStateWorkspaceIdAtom } from "@/context/collections-context";
import { activeWorkspaceAtom } from "@/context/workspace-context";
import { useEditorTabs } from "@/hooks/use-editor-tabs";
import { findRequestById } from "@/lib/collection-ops";
import { FormatIssues } from "@/modules/workspace/workspace-states";
import WorkspaceGate from "@/modules/workspace/workspace-gate";
import CollectionsWorkbench from "./workbench";

function WorkbenchSkeleton() {
  return (
    <div aria-busy className="flex h-full">
      <div className="flex w-72 flex-col gap-2 border-r border-line p-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-6" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function useOpenRequestFromSearch(requestId: string | undefined) {
  const navigate = useNavigate();
  const workspace = useAtomValue(activeWorkspaceAtom);
  const loadedFor = useAtomValue(editorStateWorkspaceIdAtom);
  const { openTab } = useEditorTabs();
  const ready = Boolean(workspace) && loadedFor === workspace?.entry.id;

  useEffect(() => {
    if (!requestId || !ready) return;
    if (findRequestById(workspace?.data ?? null, requestId)) {
      openTab({ kind: "request", id: requestId });
    }
    void navigate({ to: "/collections", search: {}, replace: true });
  }, [requestId, ready, workspace, openTab, navigate]);
}

function CollectionsPage({ requestId }: Readonly<{ requestId?: string }>) {
  useOpenRequestFromSearch(requestId);
  return (
    <WorkspaceGate loading={<WorkbenchSkeleton />}>
      {(workspace) => (
        <div className="flex h-full min-h-0 flex-col">
          {workspace.issues.length > 0 ? (
            <div className="border-b border-line px-5 py-3">
              <FormatIssues workspace={workspace} />
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <CollectionsWorkbench workspace={workspace} />
          </div>
        </div>
      )}
    </WorkspaceGate>
  );
}

export default CollectionsPage;
