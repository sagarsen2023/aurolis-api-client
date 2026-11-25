import { Button } from "@/components/ui/button";
import { HTTP_METHODS, METHOD_TEXT_CLASS } from "@/constants/request";
import { useRequestRunner } from "@/hooks/use-request-runner";
import { useUnresolvedVariables } from "@/hooks/use-unresolved-variables";
import { useTypescriptSheet } from "@/hooks/use-typescript-sheet";
import { useVariableNames } from "@/hooks/use-variable-names";
import type { TypescriptSourceId } from "@/context/collections-context";
import { payloadSource, responseSource } from "@/lib/typescript-sources";
import { cn } from "@/lib/utils";
import type { SavedRequest } from "@/types/workspace/collection-ops.type";
import type { HttpMethod } from "@/types/workspace/request.type";
import { toTypeName } from "@/utils/generate-typescript-interface";
import ResponsePanel from "../../response/response-panel";
import AuthEditor from "../../shared/auth-editor";
import KeyValueEditor from "../../shared/key-value-editor";
import OptionSelect from "../../shared/option-select";
import DocsEditor from "../docs-editor";
import EditorSectionTabs from "../editor-section-tabs";
import SplitLayout from "../split-layout";
import UnresolvedNotice from "../unresolved-notice";
import UrlBar from "../url-bar";
import BodyEditor from "./body-editor";

type HttpDraft = Extract<SavedRequest, { protocol: "http" }>;

const METHOD_OPTIONS = HTTP_METHODS.map((method) => ({
  value: method,
  label: method,
}));

function enabledCount(rows: { enabled: boolean; key: string }[]) {
  return rows.filter((row) => row.enabled && row.key).length;
}

function HttpEditor({
  request,
  onChange,
}: Readonly<{ request: HttpDraft; onChange: (request: HttpDraft) => void }>) {
  const { state, send, cancel } = useRequestRunner(request.id);
  const unresolved = useUnresolvedVariables(request);
  const variableNames = useVariableNames(request.id);
  const showTypescript = useTypescriptSheet(request.name);
  const openTypescript = (initial: TypescriptSourceId) =>
    showTypescript(
      [
        responseSource(state, toTypeName(request.name, "Response")),
        request.body.mode === "json"
          ? payloadSource(request.body.raw, toTypeName(request.name, "Request"))
          : null,
      ],
      initial,
    );
  const running = state.status === "running";

  const top = (
    <>
      <UrlBar
        url={request.url}
        placeholder="https://api.example.com/v1/payments"
        onUrlChange={(url) => onChange({ ...request, url })}
        onSubmit={() => (running ? cancel() : void send(request))}
        leading={
          <OptionSelect<HttpMethod>
            ariaLabel="Method"
            value={request.method}
            options={METHOD_OPTIONS}
            onChange={(method) => onChange({ ...request, method })}
            triggerClassName={cn(
              "h-8 w-28 border-0 bg-transparent font-mono text-[13px] font-semibold shadow-none",
              METHOD_TEXT_CLASS[request.method],
            )}
          />
        }
        action={
          <Button
            type="submit"
            className="h-10 min-w-24 px-5"
            variant={running ? "outline" : "default"}
          >
            {running ? "Cancel" : "Send"}
          </Button>
        }
      />
      {unresolved.length > 0 ? (
        <div className="px-5 pb-2">
          <UnresolvedNotice names={unresolved} />
        </div>
      ) : null}
      <EditorSectionTabs
        label="Request sections"
        defaultValue="params"
        sections={[
          {
            value: "params",
            label: "Params",
            count: enabledCount(request.params),
            content: (
              <KeyValueEditor
                label="Query parameters"
                rows={request.params}
                keyPlaceholder="Parameter"
                onChange={(params) => onChange({ ...request, params })}
              />
            ),
          },
          {
            value: "headers",
            label: "Headers",
            count: enabledCount(request.headers),
            content: (
              <KeyValueEditor
                label="Headers"
                rows={request.headers}
                keyPlaceholder="Header"
                onChange={(headers) => onChange({ ...request, headers })}
              />
            ),
          },
          {
            value: "body",
            label: "Body",
            content: (
              <BodyEditor
                body={request.body}
                method={request.method}
                variables={variableNames}
                onShowTypescript={() => openTypescript("payload")}
                onChange={(body) => onChange({ ...request, body })}
              />
            ),
          },
          {
            value: "auth",
            label: "Auth",
            content: (
              <AuthEditor
                auth={request.auth}
                onChange={(auth) => onChange({ ...request, auth })}
              />
            ),
          },
          {
            value: "docs",
            label: "Docs",
            content: (
              <DocsEditor
                subject="request"
                value={request.description}
                onChange={(description) =>
                  onChange({ ...request, description })
                }
              />
            ),
          },
        ]}
      />
    </>
  );

  return (
    <SplitLayout
      top={top}
      onModEnter={() => {
        if (!running) void send(request);
      }}
      bottom={
        <ResponsePanel
          requestId={request.id}
          state={state}
          onShowTypescript={() => openTypescript("response")}
          canSaveExample
          onCancel={cancel}
        />
      }
    />
  );
}

export default HttpEditor;
