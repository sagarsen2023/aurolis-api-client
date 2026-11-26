import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  activeWorkspaceAtom,
  activeWorkspaceStateAtom,
} from "@/context/workspace-context";
import { collectionService } from "@/services/collection.service";
import type { CollectionOp } from "@/types/workspace/collection-ops.type";

export function useCollectionActions() {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const setActive = useSetAtom(activeWorkspaceStateAtom);
  const workspaceId = workspace?.entry.id ?? null;

  const apply = useCallback(
    async (op: CollectionOp) => {
      if (!workspaceId) throw new Error("Open a workspace first.");
      const result = await collectionService.apply(workspaceId, op);
      setActive({ status: "ready", workspace: result.workspace });
      return result.createdId;
    },
    [workspaceId, setActive],
  );

  return { apply, workspaceId, data: workspace?.data ?? null };
}
