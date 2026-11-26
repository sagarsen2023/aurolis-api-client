import { useAtom, useAtomValue } from "jotai";
import { graphqlSchemasAtom } from "@/context/collections-context";
import { requestTimeoutAtom } from "@/context/settings-atoms";
import { schemaFromIntrospection } from "@/lib/graphql-schema";
import { prepareGraphql } from "@/lib/prepare-request";
import { graphqlEngineService } from "@/services/graphql-engine.service";
import type { SavedRequestOf } from "@/types/workspace/collection-ops.type";
import { useRequestContext } from "./use-request-context";
import { usePromise } from "./usePromise";

export function useGraphqlSchema(request: SavedRequestOf<"graphql">) {
  const [schemas, setSchemas] = useAtom(graphqlSchemasAtom);
  const timeoutSeconds = useAtomValue(requestTimeoutAtom);
  const getContext = useRequestContext(request.id);
  const result = schemas[request.id];

  const { loading, runPromise: load } = usePromise({
    promise: () => {
      const prepared = prepareGraphql(request, getContext());
      return graphqlEngineService.introspect({
        url: prepared.url,
        headers: prepared.headers,
        timeoutMs: Number(timeoutSeconds) * 1000,
      });
    },
    onSuccess: (loaded) =>
      setSchemas((current) => ({ ...current, [request.id]: loaded })),
  });

  return {
    summary: result?.summary ?? null,
    schema: schemaFromIntrospection(result?.introspection),
    loading,
    load,
  };
}
