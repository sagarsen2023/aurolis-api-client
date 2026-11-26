import { useState } from "react";
import { useSetAtom } from "jotai";
import {
  Copy,
  FileCode2,
  FileText,
  SendHorizontal,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Pill } from "@/components/ui/pill";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  expandedNodesAtom,
  type RunState,
} from "@/context/collections-context";
import { useCollectionActions } from "@/hooks/use-collection-actions";
import { useEditorTabs } from "@/hooks/use-editor-tabs";
import { usePromise } from "@/hooks/usePromise";
import type { HttpResponseData } from "@/types/engine/http-engine.type";
import { formatBytes } from "@/utils/format-bytes";
import { formatDuration } from "@/utils/format-duration";
import { prettyJson } from "@/utils/json";
import { MOD_KEY } from "@/utils/platform";
import UnresolvedNotice from "../editor/unresolved-notice";
import HeadersTable from "./headers-table";
import ResponseBody from "./response-body";
import StatusPill from "./status-pill";

function exampleBody(response: HttpResponseData) {
  return prettyJson(response.body) ?? response.body;
}

function SaveExampleDialog({
  requestId,
  response,
  onClose,
}: Readonly<{
  requestId: string;
  response: HttpResponseData;
  onClose: () => void;
}>) {
  const [name, setName] = useState(
    `${response.status} ${response.statusText}`.trim(),
  );
  const { apply } = useCollectionActions();
  const { openTab } = useEditorTabs();
  const setExpanded = useSetAtom(expandedNodesAtom);
  const { loading, runPromise } = usePromise({
    promise: () =>
      apply({
        op: "create-example",
        requestId,
        example: {
          name: name.trim(),
          status: response.status,
          headers: response.headers.map(([key, value]) => ({
            key,
            value,
            enabled: true,
          })),
          body: exampleBody(response),
        },
      }),
    onSuccess: (createdId) => {
      toast.success("Saved as an example");
      setExpanded((current) => ({ ...current, [requestId]: true }));
      if (createdId) openTab({ kind: "example", id: createdId, requestId });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) void runPromise();
          }}
        >
          <DialogHeader>
            <DialogTitle>Save as example</DialogTitle>
            <DialogDescription>
              Keeps this status, its headers and body in the repository, next to
              the request.
            </DialogDescription>
          </DialogHeader>
          <Input
            id="example-name"
            label="Name"
            autoFocus
            maxLength={200}
            value={name}
            error={name.trim() ? undefined : "Enter a name."}
            onChange={(event) => setName(event.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              Save example
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResponseSummary({
  state,
  canSaveExample,
  onSaveExample,
  onShowTypescript,
}: Readonly<{
  state: Extract<RunState, { status: "done" }>;
  canSaveExample: boolean;
  onSaveExample: () => void;
  onShowTypescript?: () => void;
}>) {
  const { response, graphqlErrors } = state;
  const copyBody = () => {
    void navigator.clipboard.writeText(response.body);
    toast.success("Body copied");
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-mute">
        <StatusPill status={response.status} statusText={response.statusText} />
        <span>{formatDuration(response.timings.totalMs)}</span>
        <span aria-hidden>·</span>
        <span>{formatBytes(response.size)}</span>
        {graphqlErrors ? (
          <Pill variant="err">
            {graphqlErrors} GraphQL {graphqlErrors === 1 ? "error" : "errors"}
          </Pill>
        ) : null}
        {response.redirected ? <Pill variant="outline">Redirected</Pill> : null}
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="xs"
          variant="ghost"
          disabled={response.bodyEncoding !== "text"}
          onClick={copyBody}
        >
          <Copy />
          Copy
        </Button>
        {canSaveExample ? (
          <Button
            size="xs"
            variant="outline"
            disabled={response.bodyEncoding !== "text"}
            onClick={onSaveExample}
          >
            <FileText />
            Save as example
          </Button>
        ) : null}
        {onShowTypescript ? (
          <Button
            size="xs"
            variant="outline"
            disabled={prettyJson(response.body) === null}
            onClick={onShowTypescript}
          >
            <FileCode2 />
            TypeScript
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function IdleState() {
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SendHorizontal />
        </EmptyMedia>
        <EmptyTitle>No response yet</EmptyTitle>
        <EmptyDescription>
          Send the request to see its status, headers and body. Press{" "}
          <Kbd>{MOD_KEY} Enter</Kbd> to send.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function RunningState({ onCancel }: Readonly<{ onCancel: () => void }>) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-[13px] text-mute">
      <Spinner className="size-5 text-vio" />
      Waiting for the response…
      <Button size="sm" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function ErrorState({ message }: Readonly<{ message: string }>) {
  return (
    <div
      role="alert"
      className="m-5 flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </div>
  );
}

function ResponsePanel({
  requestId,
  state,
  canSaveExample,
  onShowTypescript,
  onCancel,
}: Readonly<{
  requestId: string;
  state: RunState;
  canSaveExample: boolean;
  onShowTypescript?: () => void;
  onCancel: () => void;
}>) {
  const [savingExample, setSavingExample] = useState(false);

  if (state.status === "idle") return <IdleState />;
  if (state.status === "running") return <RunningState onCancel={onCancel} />;
  if (state.status === "error") return <ErrorState message={state.message} />;

  return (
    <section
      aria-label="Response"
      className="flex h-full min-h-0 flex-col gap-3 px-5 pt-3"
    >
      <ResponseSummary
        state={state}
        canSaveExample={canSaveExample}
        onSaveExample={() => setSavingExample(true)}
        onShowTypescript={onShowTypescript}
      />
      <UnresolvedNotice names={state.unresolved} />
      <Tabs defaultValue="body" className="min-h-0 flex-1 gap-2">
        <TabsList variant="line">
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="headers">
            Headers
            <span className="text-dim">{state.response.headers.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="body" className="flex min-h-0 flex-col pb-4">
          <ResponseBody response={state.response} />
        </TabsContent>
        <TabsContent value="headers" className="min-h-0">
          <ScrollArea className="h-full pb-4">
            <HeadersTable
              label="Response headers"
              headers={state.response.headers}
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>
      {savingExample ? (
        <SaveExampleDialog
          requestId={requestId}
          response={state.response}
          onClose={() => setSavingExample(false)}
        />
      ) : null}
    </section>
  );
}

export default ResponsePanel;
