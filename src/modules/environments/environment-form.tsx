import { useSetAtom } from "jotai";
import {
  Copy,
  Ellipsis,
  Globe,
  KeyRound,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { environmentIdAtom } from "@/context/workspace-context";
import { useCollectionActions } from "@/hooks/use-collection-actions";
import { useItemForm } from "@/hooks/use-item-form";
import { handleError, usePromise } from "@/hooks/usePromise";
import KeyValueEditor from "@/modules/collections/shared/key-value-editor";
import type { Environment } from "@/types/workspace/environment.type";
import { variableSummary } from "./variable-summary";

export type EnvironmentTarget =
  | { kind: "globals"; environment: Environment }
  | {
      kind: "environment";
      environment: Environment;
      inUse: boolean;
      isDefault: boolean;
    };

function EnvironmentMenu({
  target,
  onDuplicated,
  onDelete,
}: Readonly<{
  target: Extract<EnvironmentTarget, { kind: "environment" }>;
  onDuplicated: (id: string) => void;
  onDelete: () => void;
}>) {
  const { apply } = useCollectionActions();
  const { id, name } = target.environment;

  const makeDefault = () =>
    apply({
      op: "set-default-environment",
      id: target.isDefault ? null : id,
    })
      .then(() =>
        toast.success(
          target.isDefault
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
            size="icon-sm"
            aria-label={`More actions for ${name}`}
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onClick={() => void makeDefault()}>
          <Star aria-hidden />
          {target.isDefault ? "Clear default" : "Make default"}
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
  target,
  secretsPersisted,
  onDuplicated,
  onDelete,
}: Readonly<{
  target: EnvironmentTarget;
  secretsPersisted: boolean;
  onDuplicated: (id: string) => void;
  onDelete: () => void;
}>) {
  const { environment } = target;
  const isGlobals = target.kind === "globals";
  const { form, setForm, isDirty, reset } = useItemForm({
    name: environment.name,
    variables: environment.variables,
  });
  const { apply } = useCollectionActions();
  const setEnvironmentId = useSetAtom(environmentIdAtom);
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
    onSuccess: () => toast.success(isGlobals ? "Globals saved" : "Saved"),
  });
  const hasSecrets = form.variables.some((variable) => variable.secret);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex items-center gap-1.5 text-[12px] text-dim">
            {isGlobals ? (
              <Globe className="size-3.5" aria-hidden />
            ) : (
              <SlidersHorizontal className="size-3.5 text-vio" aria-hidden />
            )}
            {isGlobals ? "Globals" : "Environment"} ·{" "}
            {variableSummary(form.variables)}
          </p>
          {isGlobals ? (
            <h2 className="px-1.5 text-[17px] leading-8 font-medium tracking-[-0.01em] text-foreground">
              Globals
            </h2>
          ) : (
            <input
              aria-label="Name"
              value={form.name}
              maxLength={200}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              className="h-8 min-w-0 rounded-lg border border-transparent bg-transparent px-1.5 text-[17px] font-medium tracking-[-0.01em] text-foreground outline-none hover:border-line focus-visible:border-ring"
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isDirty ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw />
              Discard changes
            </Button>
          ) : null}
          {target.kind === "environment" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={target.inUse}
                onClick={() => setEnvironmentId(environment.id)}
              >
                {target.inUse ? "In use" : "Use"}
              </Button>
              <EnvironmentMenu
                target={target}
                onDuplicated={onDuplicated}
                onDelete={onDelete}
              />
            </>
          ) : null}
          <Button
            size="sm"
            variant={isDirty ? "default" : "outline"}
            disabled={!isDirty || loading || !form.name.trim()}
            onClick={() => void save()}
          >
            <Save />
            {isDirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex max-w-4xl flex-col gap-4 px-5 py-5">
          <p className="text-[12.5px] text-mute">
            {isGlobals
              ? "Globals apply in every environment. Collection variables and the active environment override them."
              : "Use them as {{name}} in any request while this environment is in use. They override collection variables and globals."}{" "}
            Mark a value as secret{" "}
            <KeyRound className="inline size-3 align-[-1px]" aria-hidden /> to
            keep it encrypted on this computer: it is never written to the
            repository.
          </p>
          {hasSecrets && !secretsPersisted ? <SecretsNotice /> : null}
          <KeyValueEditor
            label={isGlobals ? "Global variables" : "Environment variables"}
            rows={form.variables}
            keyPlaceholder="Variable"
            secrets
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
        </div>
      </div>
    </div>
  );
}

export default EnvironmentForm;
