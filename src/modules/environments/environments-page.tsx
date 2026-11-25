import { useState } from "react";
import { useAtomValue } from "jotai";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { currentEnvironmentAtom } from "@/context/workspace-context";
import { formKey } from "@/hooks/use-item-form";
import WorkspaceGate from "@/modules/workspace/workspace-gate";
import type { Environment } from "@/types/workspace/environment.type";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";
import {
  DeleteEnvironmentDialog,
  NewEnvironmentDialog,
} from "./environment-dialogs";
import EnvironmentForm, { type EnvironmentTarget } from "./environment-form";
import EnvironmentList from "./environment-list";

const EMPTY_GLOBALS: Environment = {
  id: "globals",
  name: "Globals",
  seq: 0,
  variables: [],
};

type Dialog = { kind: "new" } | { kind: "delete"; environment: Environment };

function PageSkeleton() {
  return (
    <div aria-busy className="flex h-full">
      <div className="flex w-72 flex-col gap-2 border-r border-line p-4">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function EnvironmentsWorkbench({
  workspace,
}: Readonly<{ workspace: OpenedWorkspace }>) {
  const environments = workspace.data?.environments ?? [];
  const globals = workspace.data?.globals ?? EMPTY_GLOBALS;
  const defaultId = workspace.data?.manifest.defaultEnvironment ?? null;
  const inUseId = useAtomValue(currentEnvironmentAtom)?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(inUseId ?? null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const selected = environments.find((e) => e.id === selectedId);

  const target: EnvironmentTarget = selected
    ? {
        kind: "environment",
        environment: selected,
        inUse: selected.id === inUseId,
        isDefault: selected.id === defaultId,
      }
    : { kind: "globals", environment: globals };

  return (
    <>
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel defaultSize="24" minSize={220} maxSize="40">
          <EnvironmentList
            environments={environments}
            globals={globals}
            selectedId={selected?.id ?? null}
            inUseId={inUseId}
            defaultId={defaultId}
            onSelect={setSelectedId}
            onCreate={() => setDialog({ kind: "new" })}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel minSize="40">
          <EnvironmentForm
            key={formKey(target.environment.id, target.environment)}
            target={target}
            secretsPersisted={workspace.secretsPersisted}
            onDuplicated={setSelectedId}
            onDelete={() =>
              selected && setDialog({ kind: "delete", environment: selected })
            }
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      {dialog?.kind === "new" ? (
        <NewEnvironmentDialog
          onCreated={setSelectedId}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <DeleteEnvironmentDialog
          environment={dialog.environment}
          onDeleted={() => setSelectedId(null)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

function EnvironmentsPage() {
  return (
    <WorkspaceGate loading={<PageSkeleton />}>
      {(workspace) => <EnvironmentsWorkbench workspace={workspace} />}
    </WorkspaceGate>
  );
}

export default EnvironmentsPage;
