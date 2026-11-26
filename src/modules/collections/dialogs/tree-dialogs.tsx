import { useRef, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { NameField } from "@/components/name-field";
import { Input } from "@/components/ui/input";
import { NEW_EXAMPLE_STATUS, PROTOCOL_OPTIONS } from "@/constants/request";
import {
  expandedNodesAtom,
  treeDialogAtom,
  type TreeDialog,
} from "@/context/collections-context";
import { useCollectionActions } from "@/hooks/use-collection-actions";
import { useEditorTabs } from "@/hooks/use-editor-tabs";
import { usePromise } from "@/hooks/usePromise";
import { cn } from "@/lib/utils";
import { nameError } from "@/utils/name";
import type { CollectionOp } from "@/types/workspace/collection-ops.type";
import type { RequestProtocol } from "@/types/workspace/request.type";
import { statusCodeError } from "@/utils/status-code";

type DialogOf<K extends TreeDialog["kind"]> = Extract<TreeDialog, { kind: K }>;

function useCreate(onCreated: (createdId: string) => void, success: string) {
  const { apply } = useCollectionActions();
  const pending = useRef<CollectionOp | null>(null);
  const { loading, runPromise } = usePromise({
    promise: () => apply(pending.current as CollectionOp),
    onSuccess: (createdId) => {
      toast.success(success);
      if (createdId) onCreated(createdId);
    },
  });
  const create = (op: CollectionOp) => {
    pending.current = op;
    void runPromise();
  };
  return { loading, create };
}

function NewCollectionDialog({ onClose }: Readonly<{ onClose: () => void }>) {
  const [name, setName] = useState("");
  const { openTab } = useEditorTabs();
  const { loading, create } = useCreate((id) => {
    openTab({ kind: "collection", id });
    onClose();
  }, "Collection created");
  return (
    <FormDialog
      title="New collection"
      description="A collection groups related requests, usually one API or service. It's saved as a folder under collections/."
      submitLabel="Create collection"
      busy={loading}
      canSubmit={!nameError(name)}
      onClose={onClose}
      onSubmit={() =>
        create({ op: "create-collection", name: name.trim(), description: "" })
      }
    >
      <NameField
        name={name}
        setName={setName}
        touched={name.length > 0}
        label="Name"
        placeholder="Payments API"
      />
    </FormDialog>
  );
}

function NewFolderDialog({
  dialog,
  onClose,
}: Readonly<{ dialog: DialogOf<"new-folder">; onClose: () => void }>) {
  const [name, setName] = useState("");
  const setExpanded = useSetAtom(expandedNodesAtom);
  const { loading, create } = useCreate((id) => {
    setExpanded((current) => ({
      ...current,
      [dialog.parentId]: true,
      [id]: true,
    }));
    onClose();
  }, "Folder created");
  return (
    <FormDialog
      title="New folder"
      description={`Inside ${dialog.parentName}. Folders can set auth for the requests in them.`}
      submitLabel="Create folder"
      busy={loading}
      canSubmit={!nameError(name)}
      onClose={onClose}
      onSubmit={() =>
        create({
          op: "create-folder",
          parentId: dialog.parentId,
          name: name.trim(),
        })
      }
    >
      <NameField
        name={name}
        setName={setName}
        touched={name.length > 0}
        label="Name"
        placeholder="Refunds"
      />
    </FormDialog>
  );
}

function ProtocolOption({
  option,
  selected,
  onSelect,
}: Readonly<{
  option: (typeof PROTOCOL_OPTIONS)[number];
  selected: boolean;
  onSelect: () => void;
}>) {
  return (
    <Button
      type="button"
      variant="ghost"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "h-auto w-full items-start justify-start gap-3 rounded-2xl border bg-card p-3 text-left font-normal whitespace-normal hover:bg-surface-raise",
        selected ? "border-vio" : "border-line",
      )}
    >
      <span
        className={cn(
          "mt-0.5 w-9 shrink-0 font-mono text-[11px] font-semibold",
          option.badgeClass,
        )}
      >
        {option.badge}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-medium text-foreground">
          {option.label}
        </span>
        <span className="text-[12.5px] text-mute">{option.description}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border",
          selected ? "border-vio bg-vio text-white" : "border-line",
        )}
      >
        {selected ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
    </Button>
  );
}

function NewRequestDialog({
  dialog,
  onClose,
}: Readonly<{ dialog: DialogOf<"new-request">; onClose: () => void }>) {
  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState<RequestProtocol>(
    dialog.protocol ?? "http",
  );
  const setExpanded = useSetAtom(expandedNodesAtom);
  const { openTab } = useEditorTabs();
  const { loading, create } = useCreate((id) => {
    setExpanded((current) => ({ ...current, [dialog.parentId]: true }));
    openTab({ kind: "request", id });
    onClose();
  }, "Request created");
  return (
    <FormDialog
      wide
      title="New request"
      description={`Inside ${dialog.parentName}. Each request is saved as its own .req.json file.`}
      submitLabel="Create request"
      busy={loading}
      canSubmit={!nameError(name)}
      onClose={onClose}
      onSubmit={() =>
        create({
          op: "create-request",
          parentId: dialog.parentId,
          name: name.trim(),
          protocol,
        })
      }
    >
      <div className="flex flex-col gap-4">
        <NameField
          name={name}
          setName={setName}
          touched={name.length > 0}
          label="Name"
          placeholder="Create payment"
        />
        <div
          role="radiogroup"
          aria-label="Request type"
          className="grid gap-2 sm:grid-cols-2"
        >
          {PROTOCOL_OPTIONS.map((option) => (
            <ProtocolOption
              key={option.value}
              option={option}
              selected={protocol === option.value}
              onSelect={() => setProtocol(option.value)}
            />
          ))}
        </div>
      </div>
    </FormDialog>
  );
}

function NewExampleDialog({
  dialog,
  onClose,
}: Readonly<{ dialog: DialogOf<"new-example">; onClose: () => void }>) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState(String(NEW_EXAMPLE_STATUS));
  const setExpanded = useSetAtom(expandedNodesAtom);
  const { openTab } = useEditorTabs();
  const { loading, create } = useCreate((id) => {
    setExpanded((current) => ({ ...current, [dialog.requestId]: true }));
    openTab({ kind: "example", id, requestId: dialog.requestId });
    onClose();
  }, "Example created");
  return (
    <FormDialog
      title="New example"
      description={`A saved response for ${dialog.requestName}, kept in the repository next to the request.`}
      submitLabel="Create example"
      busy={loading}
      canSubmit={!nameError(name) && !statusCodeError(status)}
      onClose={onClose}
      onSubmit={() =>
        create({
          op: "create-example",
          requestId: dialog.requestId,
          example: {
            name: name.trim(),
            status: Number(status),
            headers: [],
            body: "",
          },
        })
      }
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <NameField
          name={name}
          setName={setName}
          touched={name.length > 0}
          label="Name"
          placeholder="Payment created"
        />
        <Input
          id="tree-dialog-status"
          label="Status"
          inputMode="numeric"
          value={status}
          error={statusCodeError(status)}
          onChange={(event) => setStatus(event.target.value)}
        />
      </div>
    </FormDialog>
  );
}

const DELETE_OPS: Record<DialogOf<"delete">["target"], CollectionOp["op"]> = {
  collection: "delete-collection",
  folder: "delete-folder",
  request: "delete-request",
  example: "delete-example",
};

function DeleteDialog({
  dialog,
  onClose,
}: Readonly<{ dialog: DialogOf<"delete">; onClose: () => void }>) {
  const { apply } = useCollectionActions();
  const { loading, runPromise } = usePromise({
    promise: () =>
      apply({ op: DELETE_OPS[dialog.target], id: dialog.id } as CollectionOp),
    onSuccess: () => {
      toast.success(`Deleted ${dialog.name}`);
      onClose();
    },
  });
  return (
    <ConfirmDialog
      title={`Delete ${dialog.target} “${dialog.name}”?`}
      description={`${dialog.detail ? `${dialog.detail} ` : ""}Its files are removed from the working tree. Until you commit, you can still restore them with git.`}
      confirmLabel="Delete"
      busy={loading}
      onConfirm={() => void runPromise()}
      onClose={onClose}
    />
  );
}

function TreeDialogs() {
  const [dialog, setDialog] = useAtom(treeDialogAtom);
  const close = () => setDialog(null);
  if (!dialog) return null;
  switch (dialog.kind) {
    case "new-collection":
      return <NewCollectionDialog onClose={close} />;
    case "new-folder":
      return <NewFolderDialog dialog={dialog} onClose={close} />;
    case "new-request":
      return <NewRequestDialog dialog={dialog} onClose={close} />;
    case "new-example":
      return <NewExampleDialog dialog={dialog} onClose={close} />;
    case "delete":
      return <DeleteDialog dialog={dialog} onClose={close} />;
  }
}

export default TreeDialogs;
