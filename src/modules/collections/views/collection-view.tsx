import { useAtomValue, useSetAtom } from "jotai";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { treeDialogAtom } from "@/context/collections-context";
import { activeWorkspaceAtom } from "@/context/workspace-context";
import { useCollectionActions } from "@/hooks/use-collection-actions";
import { formKey, useItemForm } from "@/hooks/use-item-form";
import { usePromise } from "@/hooks/usePromise";
import { countItems, findCollectionById } from "@/lib/collection-ops";
import type { Collection } from "@/types/workspace/collection.type";
import type { CollectionSettings } from "@/types/workspace/collection-ops.type";
import { MarkdownField } from "@/components/markdown-field";
import AuthEditor from "../shared/auth-editor";
import KeyValueEditor from "../shared/key-value-editor";
import EditorSectionTabs from "../editor/editor-section-tabs";
import ItemFormHeader from "./item-form-header";

function settingsOf(collection: Collection): CollectionSettings {
  return {
    name: collection.name,
    description: collection.description,
    auth:
      collection.auth.type === "inherit" ? { type: "none" } : collection.auth,
    variables: collection.variables,
  };
}

function describeCounts(collection: Collection) {
  const { folders, requests } = countItems(collection.items);
  return `Collection · ${requests} ${requests === 1 ? "request" : "requests"}, ${folders} ${folders === 1 ? "folder" : "folders"}`;
}

function CollectionForm({ collection }: Readonly<{ collection: Collection }>) {
  const saved = settingsOf(collection);
  const { form, setForm, isDirty, reset } = useItemForm(saved);
  const { apply } = useCollectionActions();
  const setDialog = useSetAtom(treeDialogAtom);
  const { loading, runPromise: save } = usePromise({
    promise: () =>
      apply({
        op: "update-collection",
        id: collection.id,
        settings: { ...form, name: form.name.trim() },
      }),
    onSuccess: () => toast.success("Collection saved"),
  });
  const counts = countItems(collection.items);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ItemFormHeader
        icon={<Layers className="size-3.5 text-vio" aria-hidden />}
        eyebrow={describeCounts(collection)}
        name={form.name}
        onNameChange={(name) => setForm({ ...form, name })}
        isDirty={isDirty}
        saving={loading}
        canSave={Boolean(form.name.trim())}
        onSave={() => void save()}
        onDiscard={reset}
        onDelete={() =>
          setDialog({
            kind: "delete",
            target: "collection",
            id: collection.id,
            name: collection.name,
            detail:
              counts.requests + counts.folders > 0
                ? `It contains ${counts.requests} requests and ${counts.folders} folders.`
                : null,
          })
        }
      />
      <EditorSectionTabs
        label="Collection sections"
        defaultValue="overview"
        sections={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <MarkdownField
                key={collection.id}
                value={form.description}
                minHeight={360}
                onChange={(description) => setForm({ ...form, description })}
                placeholder="Describe this API in markdown: base URLs, how to authenticate, conventions…"
                emptyPreview="No description yet. Switch to Write to document this collection."
              />
            ),
          },
          {
            value: "auth",
            label: "Auth",
            content: (
              <AuthEditor
                canInherit={false}
                auth={form.auth}
                onChange={(auth) => setForm({ ...form, auth })}
              />
            ),
          },
          {
            value: "variables",
            label: "Variables",
            count: form.variables.filter((row) => row.enabled && row.key)
              .length,
            content: (
              <div className="flex flex-col gap-3">
                <p className="text-[12.5px] text-mute">
                  Use them as {"{{name}}"} in this collection's requests. The
                  active environment overrides them; they override globals.
                  Values are committed to the repository, so keep secrets in an
                  environment.
                </p>
                <KeyValueEditor
                  label="Collection variables"
                  rows={form.variables}
                  keyPlaceholder="Variable"
                  onChange={(variables) => setForm({ ...form, variables })}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function CollectionView({ collectionId }: Readonly<{ collectionId: string }>) {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const collection = findCollectionById(workspace?.data ?? null, collectionId);
  if (!collection) return null;
  return (
    <CollectionForm
      key={formKey(collection.id, settingsOf(collection))}
      collection={collection}
    />
  );
}

export default CollectionView;
