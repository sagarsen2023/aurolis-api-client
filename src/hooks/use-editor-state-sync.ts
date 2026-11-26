import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  activeTabIdAtom,
  draftsAtom,
  editorStateWorkspaceIdAtom,
  editorTabsAtom,
  graphqlSchemasAtom,
  runStatesAtom,
} from "@/context/collections-context";
import {
  activeWorkspaceAtom,
  environmentIdAtom,
} from "@/context/workspace-context";
import {
  findCollectionById,
  findExampleById,
  findFolderById,
  findRequestById,
} from "@/lib/collection-ops";
import { collectionService } from "@/services/collection.service";
import type {
  EditorTab,
  RequestDrafts,
} from "@/types/workspace/editor-state.type";
import type { WorkspaceData } from "@/types/workspace/workspace.type";
import { handleError } from "./usePromise";

const SAVE_DELAY_MS = 400;

function tabExists(data: WorkspaceData, tab: EditorTab) {
  switch (tab.kind) {
    case "request":
      return findRequestById(data, tab.id) !== null;
    case "example":
      return findExampleById(data, tab.id) !== null;
    case "collection":
      return findCollectionById(data, tab.id) !== null;
    case "folder":
      return findFolderById(data, tab.id) !== null;
  }
}

function pruneDrafts(data: WorkspaceData, drafts: RequestDrafts) {
  const kept = Object.entries(drafts).filter(
    ([id]) => findRequestById(data, id) !== null,
  );
  if (kept.length === Object.keys(drafts).length) return drafts;
  return Object.fromEntries(kept);
}

function useDebouncedSave(
  enabled: boolean,
  value: unknown,
  save: () => Promise<unknown>,
) {
  const latestSave = useRef(save);
  useLayoutEffect(() => {
    latestSave.current = save;
  });
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      latestSave.current().catch(handleError);
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, value]);
}

export function useEditorStateSync() {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const workspaceId = workspace?.isWorkspace ? workspace.entry.id : null;
  const data = workspace?.data ?? null;
  const [loadedFor, setLoadedFor] = useAtom(editorStateWorkspaceIdAtom);
  const [drafts, setDrafts] = useAtom(draftsAtom);
  const [tabs, setTabs] = useAtom(editorTabsAtom);
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom);
  const [environmentId, setEnvironmentId] = useAtom(environmentIdAtom);
  const setRuns = useSetAtom(runStatesAtom);
  const setSchemas = useSetAtom(graphqlSchemasAtom);
  const ready = Boolean(workspaceId) && loadedFor === workspaceId;

  useEffect(() => {
    setLoadedFor(null);
    setRuns({});
    setSchemas({});
    if (!workspaceId) {
      setDrafts({});
      setTabs([]);
      setActiveTabId(null);
      return;
    }
    let cancelled = false;
    collectionService
      .loadEditorState(workspaceId)
      .catch(() => ({
        drafts: {},
        ui: { tabs: [], activeTabId: null, environmentId: null },
      }))
      .then((state) => {
        if (cancelled) return;
        setDrafts(state.drafts);
        setTabs(state.ui.tabs);
        setActiveTabId(state.ui.activeTabId);
        if (state.ui.environmentId) setEnvironmentId(state.ui.environmentId);
        setLoadedFor(workspaceId);
      });
    return () => {
      cancelled = true;
    };
  }, [
    workspaceId,
    setActiveTabId,
    setDrafts,
    setEnvironmentId,
    setLoadedFor,
    setRuns,
    setSchemas,
    setTabs,
  ]);

  useEffect(() => {
    if (!ready || !data) return;
    setTabs((current) => {
      const kept = current.filter((tab) => tabExists(data, tab));
      return kept.length === current.length ? current : kept;
    });
    setDrafts((current) => pruneDrafts(data, current));
  }, [ready, data, setTabs, setDrafts]);

  useEffect(() => {
    if (!ready || !activeTabId) return;
    if (tabs.some((tab) => tab.id === activeTabId)) return;
    setActiveTabId(tabs.at(-1)?.id ?? null);
  }, [ready, tabs, activeTabId, setActiveTabId]);

  useDebouncedSave(ready, drafts, () =>
    collectionService.saveDrafts(workspaceId as string, drafts),
  );
  const ui = useMemo(
    () => ({ tabs, activeTabId, environmentId }),
    [tabs, activeTabId, environmentId],
  );
  useDebouncedSave(ready, ui, () =>
    collectionService.saveUiState(workspaceId as string, ui),
  );
}
