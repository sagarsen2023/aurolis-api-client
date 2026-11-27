import { useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  activeWorkspaceAtom,
  currentEnvironmentAtom,
} from "@/context/workspace-context";
import { findCollectionById, locateRequest } from "@/lib/collection-ops";
import { describeScope } from "@/lib/variables";
import type { Collection } from "@/types/workspace/collection.type";
import type { VariableInfo } from "@/types/workspace/variable.type";

function useScopeFor(
  pick: (data: ReturnType<typeof useWorkspaceData>) => Collection | null,
): VariableInfo[] {
  const data = useWorkspaceData();
  const environment = useAtomValue(currentEnvironmentAtom);

  return useMemo(() => {
    const collection = pick(data);
    return describeScope([
      {
        label: environment
          ? `Environment · ${environment.name}`
          : "Environment",
        variables: environment?.variables,
      },
      {
        label: collection ? `Collection · ${collection.name}` : "Collection",
        variables: collection?.variables,
      },
      { label: "Globals", variables: data?.globals?.variables },
    ]);
  }, [data, environment, pick]);
}

function useWorkspaceData() {
  return useAtomValue(activeWorkspaceAtom)?.data ?? null;
}

export function useRequestVariableScope(requestId: string) {
  const pick = useMemo(
    () => (data: ReturnType<typeof useWorkspaceData>) =>
      locateRequest(data, requestId)?.collection ?? null,
    [requestId],
  );
  return useScopeFor(pick);
}

export function useCollectionVariableScope(collectionId: string) {
  const pick = useMemo(
    () => (data: ReturnType<typeof useWorkspaceData>) =>
      findCollectionById(data, collectionId),
    [collectionId],
  );
  return useScopeFor(pick);
}
