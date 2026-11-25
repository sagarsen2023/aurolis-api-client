import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequestRunner } from "@/hooks/use-request-runner";
import { useGraphqlSchema } from "@/hooks/use-graphql-schema";
import { useUnresolvedVariables } from "@/hooks/use-unresolved-variables";
import { useTypescriptSheet } from "@/hooks/use-typescript-sheet";
import { useVariableNames } from "@/hooks/use-variable-names";
import type { TypescriptSourceId } from "@/context/collections-context";
import { payloadSource, responseSource } from "@/lib/typescript-sources";
import type { SavedRequestOf } from "@/types/workspace/collection-ops.type";
import type { GraphqlOperation } from "@/types/workspace/request.type";
import { toTypeName } from "@/utils/generate-typescript-interface";
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
import { countEnabled } from "@/utils/count-enabled";

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

function SchemaHint({
  loaded,
  loading,
  canLoad,
  onLoad,
}: Readonly<{
  loaded: boolean;
  loading: boolean;
  canLoad: boolean;
  onLoad: () => void;
}>) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12.5px] text-mute">
      <span className="flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-vio" aria-hidden />
        {loaded
          ? "Schema loaded: fields and arguments autocomplete, and invalid queries are underlined."
          : "Load the schema to autocomplete fields and check the query."}
      </span>
      <Button
        size="xs"
        variant="ghost"
        disabled={loading || !canLoad}
        onClick={onLoad}
      >
        <RefreshCw className={loading ? "animate-spin" : undefined} />
        {loaded ? "Reload schema" : "Load schema"}
      </Button>
    </div>
  );
}

function GraphqlEditor({
  request,
  onChange,
}: Readonly<{
  request: SavedRequestOf<"graphql">;
  onChange: (request: SavedRequestOf<"graphql">) => void;
}>) {
  const { state, send, cancel } = useRequestRunner(request.id);
  const unresolved = useUnresolvedVariables(request);
  const variableNames = useVariableNames(request.id);
  const graphqlSchema = useGraphqlSchema(request);
  const showTypescript = useTypescriptSheet(request.name);
  const openTypescript = (initial: TypescriptSourceId) =>
    showTypescript(
      [
        responseSource(state, toTypeName(request.name, "Response")),
        payloadSource(
          operation.variables,
          toTypeName(request.name, "Variables"),
          "Variables",
        ),
      ],
      initial,
    );
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
                <SchemaHint
                  loaded={graphqlSchema.schema !== null}
                  loading={graphqlSchema.loading}
                  canLoad={Boolean(request.url.trim())}
                  onLoad={() => void graphqlSchema.load()}
                />
                <CodeEditor
                  label="GraphQL query"
                  language="graphql"
                  graphqlSchema={graphqlSchema.schema}
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
                variables={variableNames}
                onShowTypescript={() => openTypescript("payload")}
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
            count: countEnabled(request.headers),
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
          onShowTypescript={() => openTypescript("response")}
          canSaveExample
          onCancel={cancel}
        />
      }
    />
  );
}

export default GraphqlEditor;
