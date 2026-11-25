import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequestRunner } from "@/hooks/use-request-runner";
import { useUnresolvedVariables } from "@/hooks/use-unresolved-variables";
import type { SavedRequest } from "@/types/workspace/collection-ops.type";
import type { GraphqlOperation } from "@/types/workspace/request.type";
import { tryParseJson } from "@/utils/json";
import ResponsePanel from "../../response/response-panel";
import AuthEditor from "../../shared/auth-editor";
import CodeEditor from "../../shared/code-editor";
import KeyValueEditor from "../../shared/key-value-editor";
import DocsEditor from "../docs-editor";
import EditorSectionTabs from "../editor-section-tabs";
import SplitLayout from "../split-layout";
import UnresolvedNotice from "../unresolved-notice";
import UrlBar from "../url-bar";
import SchemaPanel from "./schema-panel";

type GraphqlDraft = Extract<SavedRequest, { protocol: "graphql" }>;

function variablesError(variables: string) {
  if (!variables.trim()) return undefined;
  const parsed = tryParseJson(variables);
  if (!parsed.ok) return "Not valid JSON yet.";
  const value = parsed.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Variables must be a JSON object.";
  }
  return undefined;
}

function GraphqlEditor({
  request,
  onChange,
}: Readonly<{
  request: GraphqlDraft;
  onChange: (request: GraphqlDraft) => void;
}>) {
  const { state, send, cancel } = useRequestRunner(request.id);
  const unresolved = useUnresolvedVariables(request);
  const running = state.status === "running";
  const operation = request.graphql;
  const setOperation = (patch: Partial<GraphqlOperation>) =>
    onChange({ ...request, graphql: { ...operation, ...patch } });

  const top = (
    <>
      <UrlBar
        url={request.url}
        placeholder="https://api.example.com/graphql"
        onUrlChange={(url) => onChange({ ...request, url })}
        onSubmit={() => (running ? cancel() : void send(request))}
        leading={
          <span className="pl-4 font-mono text-[12px] font-semibold text-pur">
            POST
          </span>
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
        label="GraphQL sections"
        defaultValue="query"
        sections={[
          {
            value: "query",
            label: "Query",
            content: (
              <div className="flex flex-col gap-3">
                <CodeEditor
                  label="GraphQL query"
                  language="graphql"
                  minRows={12}
                  value={operation.query}
                  placeholder={
                    "query Payment($id: ID!) {\n  payment(id: $id) {\n    id\n    status\n  }\n}"
                  }
                  onChange={(query) => setOperation({ query })}
                />
                <Input
                  id="graphql-operation"
                  label="Operation name (optional)"
                  className="h-9 max-w-sm font-mono text-[13px]"
                  value={operation.operationName}
                  placeholder="Payment"
                  onChange={(event) =>
                    setOperation({ operationName: event.target.value })
                  }
                />
              </div>
            ),
          },
          {
            value: "variables",
            label: "Variables",
            content: (
              <CodeEditor
                label="GraphQL variables"
                language="json"
                value={operation.variables}
                placeholder={'{\n  "id": "{{paymentId}}"\n}'}
                error={variablesError(operation.variables)}
                onChange={(variables) => setOperation({ variables })}
              />
            ),
          },
          {
            value: "headers",
            label: "Headers",
            count: request.headers.filter((row) => row.enabled && row.key)
              .length,
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
            value: "schema",
            label: "Schema",
            content: <SchemaPanel request={request} />,
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
          canSaveExample
          onCancel={cancel}
        />
      }
    />
  );
}

export default GraphqlEditor;
