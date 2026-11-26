import { useState, type ReactNode } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  environmentDraftsAtom,
  selectedEnvironmentIdAtom,
} from "@/context/environments-context";
import { currentEnvironmentAtom } from "@/context/workspace-context";
import { FormatIssues } from "@/modules/workspace/workspace-states";
import WorkspaceGate from "@/modules/workspace/workspace-gate";
import type { Environment } from "@/types/workspace/environment.type";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";
import {
  DeleteEnvironmentDialog,
  NewEnvironmentDialog,
} from "./environment-dialogs";
import EnvironmentForm from "./environment-form";
import EnvironmentList from "./environment-list";

const EMPTY_GLOBALS: Environment = {
  id: "globals",
  name: "Globals",
  seq: 0,
  variables: [],
};

const LAYOUT = "grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]";

function EnvironmentsShell({
  actions,
  children,
}: Readonly<{ actions?: ReactNode; children: ReactNode }>) {
  return (
    <div className="mx-auto flex w-full max-w-310 flex-col gap-6 px-8 pt-8 pb-12">
      <PageHeader
        eyebrow="Variables"
        size="display"
        title={
          <>
            Environment{" "}
            <span className="font-serif font-normal tracking-normal italic">
              sets
            </span>
          </>
        }
        description={
          <>
            Values resolve as{" "}
            <b className="font-medium text-foreground">
              environment › collection › globals
            </b>
            . Secret values stay on this device and are never committed.
          </>
        }
        actions={actions}
      />
      {children}
    </div>
  );
}

function EnvironmentsSkeleton() {
  return (
    <EnvironmentsShell>
      <div aria-busy className={LAYOUT}>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </EnvironmentsShell>
  );
}

function EnvironmentsWorkbench({
  workspace,
}: Readonly<{ workspace: OpenedWorkspace }>) {
  const environments = workspace.data?.environments ?? [];
  const globals = workspace.data?.globals ?? EMPTY_GLOBALS;
  const defaultId = workspace.data?.manifest.defaultEnvironment ?? null;
  const activeId = useAtomValue(currentEnvironmentAtom)?.id ?? null;
  const [selectedId, setSelectedId] = useAtom(selectedEnvironmentIdAtom);
  const setDrafts = useSetAtom(environmentDraftsAtom);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Environment | null>(null);
  const all = [...environments, globals];
  const selected =
    all.find((e) => e.id === selectedId) ??
    all.find((e) => e.id === activeId) ??
    globals;
  const isGlobals = selected === globals;

  return (
    <EnvironmentsShell
      actions={
        <Button
          size="lg"
          className="hover:bg-lav-hover"
          onClick={() => setCreating(true)}
        >
          <Plus />
          New environment
        </Button>
      }
    >
      {workspace.issues.length > 0 ? (
        <FormatIssues workspace={workspace} />
      ) : null}
      <div className={LAYOUT}>
        <EnvironmentList
          environments={environments}
          globals={globals}
          selectedId={selected.id}
          activeId={activeId}
          defaultId={defaultId}
          onSelect={setSelectedId}
        />
        <EnvironmentForm
          key={selected.id}
          environment={selected}
          isGlobals={isGlobals}
          active={selected.id === activeId}
          isDefault={selected.id === defaultId}
          secretsPersisted={workspace.secretsPersisted}
          onDuplicated={setSelectedId}
          onDelete={() => setDeleting(selected)}
        />
      </div>
      {creating ? (
        <NewEnvironmentDialog
          onCreated={setSelectedId}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {deleting ? (
        <DeleteEnvironmentDialog
          environment={deleting}
          onDeleted={() =>
            setDrafts(({ [deleting.id]: _dropped, ...rest }) => rest)
          }
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </EnvironmentsShell>
  );
}

function EnvironmentsPage() {
  return (
    <WorkspaceGate loading={<EnvironmentsSkeleton />}>
      {(workspace) => <EnvironmentsWorkbench workspace={workspace} />}
    </WorkspaceGate>
  );
}

export default EnvironmentsPage;
