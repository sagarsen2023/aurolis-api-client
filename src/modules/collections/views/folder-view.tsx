import { useAtomValue, useSetAtom } from "jotai";
import { Folder as FolderIcon } from "lucide-react";
import { toast } from "sonner";
import { MarkdownField } from "@/components/markdown-field";
import { treeDialogAtom } from "@/context/collections-context";
import { activeWorkspaceAtom } from "@/context/workspace-context";
import { useCollectionActions } from "@/hooks/use-collection-actions";
import { formKey, useItemForm } from "@/hooks/use-item-form";
import { usePromise } from "@/hooks/usePromise";
import {
  countItems,
  locateFolder,
  type FolderLocation,
} from "@/lib/collection-ops";
import type { FolderSettings } from "@/types/workspace/collection-ops.type";
import AuthEditor from "../shared/auth-editor";
import EditorSectionTabs from "../editor/editor-section-tabs";
import ItemFormHeader from "./item-form-header";

function settingsOf(location: FolderLocation): FolderSettings {
  const { folder } = location;
  return {
    name: folder.name,
    description: folder.description,
    auth: folder.auth,
  };
}

function FolderForm({ location }: Readonly<{ location: FolderLocation }>) {
  const { folder } = location;
  const { form, setForm, isDirty, reset } = useItemForm(settingsOf(location));
  const { apply } = useCollectionActions();
  const setDialog = useSetAtom(treeDialogAtom);
  const { loading, runPromise: save } = usePromise({
    promise: () =>
      apply({
        op: "update-folder",
        id: folder.id,
        settings: { ...form, name: form.name.trim() },
      }),
    onSuccess: () => toast.success("Folder saved"),
  });
  const path = [
    location.collection.name,
    ...location.folders.map((f) => f.name),
  ];
  const counts = countItems(folder.items);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ItemFormHeader
        icon={<FolderIcon className="size-3.5" aria-hidden />}
        eyebrow={`Folder in ${path.join(" › ")}`}
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
            target: "folder",
            id: folder.id,
            name: folder.name,
            detail:
              counts.requests + counts.folders > 0
                ? `It contains ${counts.requests} requests and ${counts.folders} folders.`
                : null,
          })
        }
      />
      <EditorSectionTabs
        label="Folder sections"
        defaultValue="overview"
        sections={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <MarkdownField
                key={folder.id}
                value={form.description}
                minHeight={320}
                onChange={(description) => setForm({ ...form, description })}
                placeholder="Describe the requests in this folder in markdown…"
                emptyPreview="No description yet. Switch to Write to document this folder."
              />
            ),
          },
          {
            value: "auth",
            label: "Auth",
            content: (
              <AuthEditor
                auth={form.auth}
                onChange={(auth) => setForm({ ...form, auth })}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

function FolderView({ folderId }: Readonly<{ folderId: string }>) {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const location = locateFolder(workspace?.data ?? null, folderId);
  if (!location) return null;
  return (
    <FolderForm
      key={formKey(location.folder.id, settingsOf(location))}
      location={location}
    />
  );
}

export default FolderView;
