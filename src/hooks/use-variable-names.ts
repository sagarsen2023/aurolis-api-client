import { useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  activeWorkspaceAtom,
  currentEnvironmentAtom,
} from "@/context/workspace-context";
import { locateRequest } from "@/lib/collection-ops";
import { buildScope } from "@/lib/variables";

export function useVariableNames(requestId?: string) {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const environment = useAtomValue(currentEnvironmentAtom);
  const data = workspace?.data ?? null;

  return useMemo(() => {
    const location = requestId ? locateRequest(data, requestId) : null;
    const scope = buildScope(
      environment?.variables,
      location?.collection.variables,
      data?.globals?.variables,
    );
    return [...scope.keys()].sort((a, b) => a.localeCompare(b));
  }, [data, environment, requestId]);
}
