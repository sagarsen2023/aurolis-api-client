import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Check } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { CollectionOp } from "@/types/workspace/collection-ops.type";
import type { RequestProtocol } from "@/types/workspace/request.type";

type DialogOf<K extends TreeDialog["kind"]> = Extract<TreeDialog, { kind: K }>;

const MAX_NAME_LENGTH = 200;

function nameError(name: string) {
  if (!name.trim()) return "Enter a name.";
  if (name.trim().length > MAX_NAME_LENGTH)
    return "Use 200 characters or fewer.";
  return undefined;
}

function FormDialog({
  open,
  title,
  description,
  submitLabel,
  busy,
  canSubmit,
  onSubmit,
  onClose,
  children,
  wide,
}: Readonly<{
  open: boolean;
  title: string;
  description: ReactNode;
  submitLabel: string;
  busy: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}>) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit && !busy) onSubmit();
  };
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className={cn(wide && "sm:max-w-xl")}>
        <form className="flex flex-col gap-6" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || busy}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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

function NameField({
  name,
  setName,
  touched,
  label,
  placeholder,
}: Readonly<{
  name: string;
  setName: (name: string) => void;
  touched: boolean;
  label: string;
  placeholder: string;
}>) {
  return (
    <Input
      id="tree-dialog-name"
      label={label}
      autoFocus
      value={name}
      maxLength={MAX_NAME_LENGTH}
      placeholder={placeholder}
      error={touched ? nameError(name) : undefined}
      onChange={(event) => setName(event.target.value)}
    />
  );
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
      open
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
      open
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
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-2xl border bg-card p-3 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        selected ? "border-vio" : "border-line hover:bg-surface-raise",
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
    </button>
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
      open
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

function statusError(status: string) {
  const code = Number(status);
  if (!Number.isInteger(code) || code < 100 || code > 599) {
    return "Use a status between 100 and 599.";
  }
  return undefined;
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
      open
      title="New example"
      description={`A saved response for ${dialog.requestName}, kept in the repository next to the request.`}
      submitLabel="Create example"
      busy={loading}
      canSubmit={!nameError(name) && !statusError(status)}
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
          error={statusError(status)}
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
    <AlertDialog open onOpenChange={(next) => (next ? null : onClose())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {dialog.target} “{dialog.name}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {dialog.detail ? `${dialog.detail} ` : ""}
            Its files are removed from the working tree. Until you commit, you
            can still restore them with git.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={() => void runPromise()}
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
