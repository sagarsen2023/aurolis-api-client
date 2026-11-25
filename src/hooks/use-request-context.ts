import { useCallback } from "react";
import { useAtomValue } from "jotai";
import {
  activeWorkspaceAtom,
  currentEnvironmentAtom,
} from "@/context/workspace-context";
import { locateRequest } from "@/lib/collection-ops";
import type { RequestContext } from "@/lib/prepare-request";

export function useRequestContext(requestId: string) {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const environment = useAtomValue(currentEnvironmentAtom);
  const data = workspace?.data ?? null;

  return useCallback((): RequestContext => {
    const location = locateRequest(data, requestId);
    if (!location) throw new Error("This request no longer exists.");
    return {
      collection: location.collection,
      folders: location.folders,
      environment,
      globals: data?.globals ?? null,
    };
  }, [data, environment, requestId]);
}
