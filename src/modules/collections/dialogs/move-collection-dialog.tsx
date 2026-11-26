import { useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Plus, TriangleAlert } from "lucide-react";
import { ChoiceCard } from "@/components/choice-card";
import { FormDialog } from "@/components/form-dialog";
import { NameField } from "@/components/name-field";
import { SuccessDialog } from "@/components/success-dialog";
import { draftsAtom } from "@/context/collections-context";
import {
  activeWorkspaceAtom,
  activeWorkspaceStateAtom,
  registryAtom,
} from "@/context/workspace-context";
import { useWorkspaceActions } from "@/hooks/use-workspaces";
import { usePromise } from "@/hooks/usePromise";
import { collectRequestIds, findCollectionById } from "@/lib/collection-ops";
import { WorkspaceTile } from "@/modules/layout/workspace-switcher";
import { collectionService } from "@/services/collection.service";
import type {
  MoveCollectionResult,
  MoveCollectionTarget,
} from "@/types/workspace/collection-ops.type";
import { nameError } from "@/utils/name";
import { workspaceSubtitle } from "@/utils/workspace-subtitle";

const NEW_WORKSPACE = "new";

function MoveCollectionDialog({
  collectionId,
  collectionName,
  onClose,
}: Readonly<{
  collectionId: string;
  collectionName: string;
  onClose: () => void;
}>) {
  const registry = useAtomValue(registryAtom);
  const workspace = useAtomValue(activeWorkspaceAtom);
  const drafts = useAtomValue(draftsAtom);
  const setActive = useSetAtom(activeWorkspaceStateAtom);
  const { reloadRegistry, openWorkspace } = useWorkspaceActions();
  const destinations = useMemo(
    () =>
      (registry?.workspaces ?? []).filter(
        (item) => item.id !== workspace?.entry.id && !item.missing,
      ),
    [registry, workspace],
  );
  const [choice, setChoice] = useState(destinations[0]?.id ?? NEW_WORKSPACE);
  const [name, setName] = useState("");
  const [moved, setMoved] = useState<MoveCollectionResult | null>(null);

  const unsaved = useMemo(() => {
    const collection = workspace?.data
      ? findCollectionById(workspace.data, collectionId)
      : null;
    if (!collection) return 0;
    return collectRequestIds(collection.items).filter((id) => id in drafts)
      .length;
  }, [workspace, collectionId, drafts]);

  const target: MoveCollectionTarget =
    choice === NEW_WORKSPACE
      ? { kind: "new", name: name.trim() }
      : { kind: "existing", workspaceId: choice };

  const { loading, runPromise: move } = usePromise({
    promise: () =>
      collectionService.move({
        workspaceId: workspace?.entry.id ?? "",
        collectionId,
        target,
      }),
    onSuccessAsync: async (result) => {
      setActive({ status: "ready", workspace: result.workspace });
      await reloadRegistry();
      setMoved(result);
    },
  });

  if (moved) {
    return (
      <SuccessDialog
        title={`Moved “${collectionName}”`}
        description={`It's now in ${moved.target.name}. Commit both workspaces to record the move in git.`}
        confirmLabel={`Open ${moved.target.name}`}
        cancelLabel="Stay here"
        onClose={onClose}
        onConfirm={() => {
          onClose();
          void openWorkspace(moved.target.id);
        }}
      />
    );
  }

  const canSubmit =
    unsaved === 0 && (choice !== NEW_WORKSPACE || !nameError(name));

  return (
    <FormDialog
      title={`Move “${collectionName}”`}
      description="Its folders, requests and examples move to the workspace you pick and are removed from this one."
      submitLabel="Move collection"
      busy={loading}
      canSubmit={canSubmit}
      onClose={onClose}
      onSubmit={() => void move()}
    >
      <div
        role="radiogroup"
        aria-label="Move to"
        className="-mx-1 flex max-h-80 flex-col gap-2 overflow-y-auto px-1"
      >
        {destinations.map((item) => (
          <ChoiceCard
            key={item.id}
            selected={choice === item.id}
            onSelect={() => setChoice(item.id)}
            leading={<WorkspaceTile name={item.name} className="size-9" />}
            title={item.name}
            description={workspaceSubtitle(item)}
          />
        ))}
        <ChoiceCard
          selected={choice === NEW_WORKSPACE}
          onSelect={() => setChoice(NEW_WORKSPACE)}
          icon={Plus}
          title="New workspace"
          description="Create a local workspace and move the collection there."
        />
      </div>
      {choice === NEW_WORKSPACE ? (
        <NameField
          name={name}
          setName={setName}
          touched={name.length > 0}
          label="Workspace name"
          placeholder="Payments API"
        />
      ) : null}
      {unsaved > 0 ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-warning/40 bg-surface-2 px-3 py-2.5 text-[13px] text-mute"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-warning"
            aria-hidden
          />
          {unsaved === 1
            ? "One request in this collection has unsaved changes. Save or discard it first."
            : `${unsaved} requests in this collection have unsaved changes. Save or discard them first.`}
        </p>
      ) : null}
    </FormDialog>
  );
}

export default MoveCollectionDialog;
