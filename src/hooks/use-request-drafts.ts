import { useCallback, useMemo } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { toast } from "sonner";
import { draftsAtom } from "@/context/collections-context";
import { activeWorkspaceAtom } from "@/context/workspace-context";
import { findRequestById } from "@/lib/collection-ops";
import { isSameRequest, toSavedRequest } from "@/lib/request-draft";
import type { SavedRequest } from "@/types/workspace/collection-ops.type";
import type { RequestDrafts } from "@/types/workspace/editor-state.type";
import { useCollectionActions } from "./use-collection-actions";

function withoutDraft(drafts: RequestDrafts, id: string) {
  if (!(id in drafts)) return drafts;
  const next = { ...drafts };
  delete next[id];
  return next;
}

export function useSaveRequests() {
  const { apply } = useCollectionActions();
  const [drafts, setDrafts] = useAtom(draftsAtom);

  const saveRequest = useCallback(
    async (id: string) => {
      const draft = drafts[id];
      if (!draft) return false;
      await apply({ op: "save-request", request: draft });
      setDrafts((current) => withoutDraft(current, id));
      return true;
    },
    [apply, drafts, setDrafts],
  );

  const saveAll = useCallback(async () => {
    const ids = Object.keys(drafts);
    for (const id of ids) await saveRequest(id);
    if (ids.length > 0) {
      toast.success(
        `Saved ${ids.length} ${ids.length === 1 ? "request" : "requests"}`,
      );
    }
    return ids.length;
  }, [drafts, saveRequest]);

  const discard = useCallback(
    (id: string) => setDrafts((current) => withoutDraft(current, id)),
    [setDrafts],
  );

  return {
    saveRequest,
    saveAll,
    discard,
    hasDraft: (id: string) => id in drafts,
  };
}

export function useRequestDraft(requestId: string) {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const drafts = useAtomValue(draftsAtom);
  const setDrafts = useSetAtom(draftsAtom);
  const saved = findRequestById(workspace?.data ?? null, requestId);
  const savedShape = useMemo(
    () => (saved ? toSavedRequest(saved) : null),
    [saved],
  );
  const draft = drafts[requestId] ?? savedShape;

  const change = useCallback(
    (next: SavedRequest) => {
      setDrafts((current) => {
        if (savedShape && isSameRequest(next, savedShape)) {
          return withoutDraft(current, requestId);
        }
        return { ...current, [requestId]: next };
      });
    },
    [requestId, savedShape, setDrafts],
  );

  return {
    saved,
    draft,
    isDirty: requestId in drafts,
    change,
  };
}
