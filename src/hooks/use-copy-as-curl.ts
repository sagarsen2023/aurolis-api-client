import { useCallback } from "react";
import { toast } from "sonner";
import { graphqlLoadRequest } from "@/desktop/graphql";
import { toCurl } from "@/lib/curl";
import { prepareGraphql, prepareHttp } from "@/lib/prepare-request";
import type { CurlTarget } from "@/types/transfer/curl.type";
import type { SavedRequest } from "@/types/workspace/collection-ops.type";
import { useRequestContext } from "./use-request-context";

export function canCopyAsCurl(request: SavedRequest) {
  return request.protocol === "http" || request.protocol === "graphql";
}

function curlTarget(
  request: SavedRequest,
  context: ReturnType<ReturnType<typeof useRequestContext>>,
): { target: CurlTarget; unresolved: string[] } {
  if (request.protocol === "http") {
    const prepared = prepareHttp(request, context);
    return {
      target: {
        method: request.method,
        url: prepared.url,
        headers: prepared.headers,
        body: prepared.body,
      },
      unresolved: prepared.unresolved,
    };
  }
  if (request.protocol === "graphql") {
    const prepared = prepareGraphql(request, context);
    const params = graphqlLoadRequest(
      {
        url: prepared.url,
        headers: prepared.headers,
        ...prepared.operation,
        timeoutMs: 0,
      },
      "curl",
    );
    return {
      target: {
        method: params.method,
        url: params.url,
        headers: params.headers,
        body: params.body,
      },
      unresolved: prepared.unresolved,
    };
  }
  throw new Error("Only HTTP and GraphQL requests can be copied as cURL.");
}

export function useCopyAsCurl(request: SavedRequest) {
  const context = useRequestContext(request.id);

  return useCallback(async () => {
    try {
      const { target, unresolved } = curlTarget(request, context());
      if (!target.url) throw new Error("Add a URL first.");
      await navigator.clipboard.writeText(toCurl(target));
      if (unresolved.length > 0) {
        toast.warning("Copied as cURL", {
          description: `No value for ${unresolved.map((name) => `{{${name}}}`).join(", ")}, so they were left as they are.`,
        });
      } else {
        toast.success("Copied as cURL", {
          description: "Variables are replaced with their current values.",
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't copy as cURL.",
      );
    }
  }, [context, request]);
}
