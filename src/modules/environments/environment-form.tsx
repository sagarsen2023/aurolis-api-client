import { useSetAtom } from "jotai";
import {
  Check,
  Copy,
  Ellipsis,
  RotateCcw,
  Save,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { environmentIdAtom } from "@/context/workspace-context";
import { useCollectionActions } from "@/hooks/use-collection-actions";
import { useEnvironmentDraft } from "@/hooks/use-environment-draft";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { handleError, usePromise } from "@/hooks/usePromise";
import KeyValueEditor from "@/modules/collections/shared/key-value-editor";
import type { Environment } from "@/types/workspace/environment.type";

function EnvironmentMenu({
  environment,
  isDefault,
  onDuplicated,
  onDelete,
}: Readonly<{
  environment: Environment;
  isDefault: boolean;
  onDuplicated: (id: string) => void;
  onDelete: () => void;
}>) {
  const { apply } = useCollectionActions();
  const { id, name } = environment;

  const toggleDefault = () =>
    apply({ op: "set-default-environment", id: isDefault ? null : id })
      .then(() =>
        toast.success(
          isDefault
            ? "Default environment cleared"
            : `“${name}” is now the default`,
        ),
      )
      .catch(handleError);

  const duplicate = () =>
    apply({ op: "duplicate-environment", id })
      .then((createdId) => {
        toast.success("Environment duplicated");
        if (createdId) onDuplicated(createdId);
      })
      .catch(handleError);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`More actions for ${name}`}
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onClick={() => void toggleDefault()}>
          <Star aria-hidden />
          {isDefault ? "Clear default" : "Make default"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void duplicate()}>
          <Copy aria-hidden />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={onDelete}>
          <Trash2 aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SecretsNotice() {
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-xl bg-warn/15 px-3 py-2 text-[12.5px] text-foreground"
    >
      <TriangleAlert
        className="mt-0.5 size-3.5 shrink-0 text-warning"
        aria-hidden
      />
      No system keychain is available, so secret values are kept in memory only.
      They are cleared when Aurolis quits.
    </p>
  );
}

function EnvironmentForm({
  environment,
  isGlobals,
  active,
  isDefault,
  secretsPersisted,
  onDuplicated,
  onDelete,
}: Readonly<{
  environment: Environment;
  isGlobals: boolean;
  active: boolean;
  isDefault: boolean;
  secretsPersisted: boolean;
  onDuplicated: (id: string) => void;
  onDelete: () => void;
}>) {
  const { form, setForm, isDirty, discard } = useEnvironmentDraft(environment);
  const { apply } = useCollectionActions();
  const setEnvironmentId = useSetAtom(environmentIdAtom);
  const canSave = isDirty && Boolean(form.name.trim());
  const { loading, runPromise: save } = usePromise({
    promise: () =>
      apply(
        isGlobals
          ? { op: "update-globals", variables: form.variables }
          : {
              op: "update-environment",
              id: environment.id,
              settings: { ...form, name: form.name.trim() },
            },
      ),
    onSuccess: () => {
      discard();
      toast.success(isGlobals ? "Globals saved" : `Saved ${form.name.trim()}`);
    },
  });

  useSaveShortcut(() => {
    if (canSave && !loading) void save();
  });

  return (
    <Card displayGradient className="gap-4 p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        {isGlobals ? (
          <h2 className="min-w-45 flex-1 text-[22px] font-semibold tracking-[-0.02em] text-foreground">
            Globals
          </h2>
        ) : (
          <input
            aria-label="Environment name"
            value={form.name}
            maxLength={200}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="h-11 min-w-45 flex-1 rounded-xl border border-line-strong bg-surface-2 px-3 text-[18px] font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
        )}
        {isDirty ? (
          <Button variant="ghost" onClick={discard}>
            <RotateCcw />
            Discard
          </Button>
        ) : null}
        {isGlobals ? null : (
          <Button
            variant={active ? "outline" : "default"}
            disabled={active}
            className={active ? undefined : "hover:bg-lav-hover"}
            onClick={() => setEnvironmentId(environment.id)}
          >
            {active ? "Active" : "Set active"}
          </Button>
        )}
        <Button
          variant="outline"
          title="Save (Ctrl/⌘ S)"
          disabled={!canSave || loading}
          onClick={() => void save()}
        >
          {isDirty ? <Save /> : <Check />}
          {isDirty ? "Save" : "Saved"}
        </Button>
        {isGlobals ? null : (
          <EnvironmentMenu
            environment={environment}
            isDefault={isDefault}
            onDuplicated={onDuplicated}
            onDelete={onDelete}
          />
        )}
      </div>
      {!secretsPersisted && form.variables.some((row) => row.secret) ? (
        <SecretsNotice />
      ) : null}
      <KeyValueEditor
        label={isGlobals ? "Global variables" : `${environment.name} variables`}
        rows={form.variables}
        keyPlaceholder="Variable"
        secrets
        boxed
        onChange={(rows) =>
          setForm({
            ...form,
            variables: rows.map((row) => ({
              ...row,
              secret: row.secret ?? false,
            })),
          })
        }
      />
    </Card>
  );
}

export default EnvironmentForm;
