import { useAtom, useAtomValue } from "jotai";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestTimeoutAtom } from "@/context/settings-atoms";
import { graphqlSchemasAtom } from "@/context/collections-context";
import { useRequestContext } from "@/hooks/use-request-context";
import { usePromise } from "@/hooks/usePromise";
import { prepareGraphql } from "@/lib/prepare-request";
import { graphqlEngineService } from "@/services/graphql-engine.service";
import type { GraphqlField } from "@/types/engine/graphql-engine.type";
import type { SavedRequest } from "@/types/workspace/collection-ops.type";

type GraphqlDraft = Extract<SavedRequest, { protocol: "graphql" }>;

const ROOTS = [
  { key: "query", label: "Queries" },
  { key: "mutation", label: "Mutations" },
  { key: "subscription", label: "Subscriptions" },
] as const;

function fieldSignature(field: GraphqlField) {
  const args = field.args.map((arg) => `${arg.name}: ${arg.type}`).join(", ");
  return `${field.name}${args ? `(${args})` : ""}: ${field.type}`;
}

function FieldList({ fields }: Readonly<{ fields: GraphqlField[] }>) {
  return (
    <ul className="flex flex-col divide-y divide-line/60">
      {fields.map((field) => (
        <li key={field.name} className="py-1.5">
          <code className="font-mono text-[12.5px] break-all text-foreground">
            {fieldSignature(field)}
          </code>
          {field.description ? (
            <p className="text-[12px] text-mute">{field.description}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function SchemaPanel({ request }: Readonly<{ request: GraphqlDraft }>) {
  const [schemas, setSchemas] = useAtom(graphqlSchemasAtom);
  const timeoutSeconds = useAtomValue(requestTimeoutAtom);
  const getContext = useRequestContext(request.id);
  const schema = schemas[request.id];

  const { loading, runPromise: load } = usePromise({
    promise: () => {
      const prepared = prepareGraphql(request, getContext());
      return graphqlEngineService.introspect({
        url: prepared.url,
        headers: prepared.headers,
        timeoutMs: Number(timeoutSeconds) * 1000,
      });
    },
    onSuccess: (summary) =>
      setSchemas((current) => ({ ...current, [request.id]: summary })),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-mute">
          Loads the root fields from the server with an introspection query,
          using this request's URL, headers and auth.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={loading || !request.url.trim()}
          onClick={() => void load()}
        >
          <RefreshCw className={loading ? "animate-spin" : undefined} />
          {schema ? "Reload schema" : "Load schema"}
        </Button>
      </div>
      {schema
        ? ROOTS.map((root) =>
            schema[root.key].length > 0 ? (
              <section key={root.key} aria-label={root.label}>
                <h3 className="mb-1 text-[12px] font-medium text-dim">
                  {root.label} · {schema[root.key].length}
                </h3>
                <FieldList fields={schema[root.key]} />
              </section>
            ) : null,
          )
        : null}
    </div>
  );
}

export default SchemaPanel;
