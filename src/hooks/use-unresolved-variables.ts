import { useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  activeWorkspaceAtom,
  currentEnvironmentAtom,
} from "@/context/workspace-context";
import { locateRequest } from "@/lib/collection-ops";
import { buildScope, unresolvedNames } from "@/lib/variables";
import type { SavedRequest } from "@/types/workspace/collection-ops.type";

function variableFields(request: SavedRequest) {
  const { description: _description, name: _name, ...fields } = request;
  if ("messages" in fields) {
    const { messages: _messages, ...rest } = fields;
    return rest;
  }
  return fields;
}

export function useUnresolvedVariables(request: SavedRequest) {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const environment = useAtomValue(currentEnvironmentAtom);
  const data = workspace?.data ?? null;

  return useMemo(() => {
    const location = locateRequest(data, request.id);
    const scope = buildScope(
      environment?.variables,
      location?.collection.variables,
      data?.globals?.variables,
    );
    return unresolvedNames(variableFields(request), scope);
  }, [data, environment, request]);
}
