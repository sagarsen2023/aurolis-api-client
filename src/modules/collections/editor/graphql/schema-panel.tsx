import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGraphqlSchema } from "@/hooks/use-graphql-schema";
import type { GraphqlField } from "@/types/engine/graphql-engine.type";
import type { SavedRequestOf } from "@/types/workspace/collection-ops.type";

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

function SchemaPanel({
  request,
}: Readonly<{ request: SavedRequestOf<"graphql"> }>) {
  const { summary: schema, loading, load } = useGraphqlSchema(request);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-mute">
          Loads the schema with an introspection query, using this request's
          URL, headers and auth. Once loaded, the Query editor autocompletes
          fields and arguments and flags invalid queries.
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
