import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarkdownField } from "@/components/markdown-field";
import { useCollectionActions } from "@/hooks/use-collection-actions";
import { formKey, useItemForm } from "@/hooks/use-item-form";
import { usePromise } from "@/hooks/usePromise";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";

function AboutForm({ saved }: Readonly<{ saved: string }>) {
  const { form, setForm, isDirty, reset } = useItemForm(saved);
  const { apply } = useCollectionActions();
  const { loading, runPromise: save } = usePromise({
    promise: () => apply({ op: "update-workspace", description: form }),
    onSuccess: () => toast.success("Workspace description saved"),
  });

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>About this workspace</CardTitle>
        <CardDescription>
          Saved in aurolis.json, so everyone who clones the repository sees it.
        </CardDescription>
        {isDirty ? (
          <CardAction className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw />
              Discard
            </Button>
            <Button size="sm" disabled={loading} onClick={() => void save()}>
              <Save />
              Save
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <MarkdownField
          value={form}
          onChange={setForm}
          minHeight={260}
          placeholder="Describe this workspace in markdown: which APIs it covers, how to get credentials, who owns it…"
          emptyPreview="No description yet. Switch to Write to add one."
        />
      </CardContent>
    </Card>
  );
}

function WorkspaceAbout({
  workspace,
}: Readonly<{ workspace: OpenedWorkspace }>) {
  const saved = workspace.data?.manifest.description ?? "";
  return <AboutForm key={formKey(workspace.entry.id, saved)} saved={saved} />;
}

export default WorkspaceAbout;
