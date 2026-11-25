import { useAtomValue, useSetAtom } from "jotai";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { treeDialogAtom } from "@/context/collections-context";
import { activeWorkspaceAtom } from "@/context/workspace-context";
import { useCollectionActions } from "@/hooks/use-collection-actions";
import { formKey, useItemForm } from "@/hooks/use-item-form";
import { usePromise } from "@/hooks/usePromise";
import { findExampleById } from "@/lib/collection-ops";
import type { ExampleInput } from "@/types/workspace/collection-ops.type";
import type {
  ApiRequest,
  RequestExample,
} from "@/types/workspace/request.type";
import EditorSectionTabs from "../editor/editor-section-tabs";
import StatusPill from "../response/status-pill";
import CodeEditor from "../shared/code-editor";
import KeyValueEditor from "../shared/key-value-editor";
import ItemFormHeader from "./item-form-header";

type ExampleForm = Omit<ExampleInput, "status"> & { status: string };

function formOf(example: RequestExample): ExampleForm {
  return {
    name: example.name,
    status: String(example.status),
    headers: example.headers,
    body: example.body,
  };
}

function statusError(status: string) {
  const code = Number(status);
  return Number.isInteger(code) && code >= 100 && code <= 599
    ? undefined
    : "Use a status between 100 and 599.";
}

function ExampleEditor({
  example,
  request,
}: Readonly<{ example: RequestExample; request: ApiRequest }>) {
  const { form, setForm, isDirty, reset } = useItemForm(formOf(example));
  const { apply } = useCollectionActions();
  const setDialog = useSetAtom(treeDialogAtom);
  const invalidStatus = statusError(form.status);
  const { loading, runPromise: save } = usePromise({
    promise: () =>
      apply({
        op: "update-example",
        id: example.id,
        example: {
          ...form,
          name: form.name.trim(),
          status: Number(form.status),
        },
      }),
    onSuccess: () => toast.success("Example saved"),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ItemFormHeader
        icon={<FileText className="size-3.5" aria-hidden />}
        eyebrow={`Example of ${request.name}`}
        name={form.name}
        onNameChange={(name) => setForm({ ...form, name })}
        isDirty={isDirty}
        saving={loading}
        canSave={Boolean(form.name.trim()) && !invalidStatus}
        onSave={() => void save()}
        onDiscard={reset}
        onDelete={() =>
          setDialog({
            kind: "delete",
            target: "example",
            id: example.id,
            name: example.name,
            detail: null,
          })
        }
      />
      <div className="flex items-start gap-3 px-5 pt-4 pb-2">
        <div className="w-28">
          <Input
            id="example-status"
            label="Status"
            inputMode="numeric"
            className="h-9 font-mono"
            value={form.status}
            error={invalidStatus}
            onChange={(event) =>
              setForm({ ...form, status: event.target.value })
            }
          />
        </div>
        {invalidStatus ? null : (
          <div className="pt-8">
            <StatusPill status={Number(form.status)} />
          </div>
        )}
      </div>
      <EditorSectionTabs
        label="Example sections"
        defaultValue="body"
        sections={[
          {
            value: "body",
            label: "Body",
            content: (
              <CodeEditor
                label="Example body"
                language="json"
                minRows={16}
                value={form.body}
                onChange={(body) => setForm({ ...form, body })}
              />
            ),
          },
          {
            value: "headers",
            label: "Headers",
            count: form.headers.filter((row) => row.enabled && row.key).length,
            content: (
              <KeyValueEditor
                label="Example headers"
                rows={form.headers}
                keyPlaceholder="Header"
                onChange={(headers) => setForm({ ...form, headers })}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

function ExampleView({ exampleId }: Readonly<{ exampleId: string }>) {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const found = findExampleById(workspace?.data ?? null, exampleId);
  if (!found) return null;
  return (
    <ExampleEditor
      key={formKey(found.example.id, formOf(found.example))}
      example={found.example}
      request={found.request}
    />
  );
}

export default ExampleView;
