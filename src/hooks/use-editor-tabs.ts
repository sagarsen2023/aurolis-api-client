import { useCallback } from "react";
import { useAtom } from "jotai";
import { activeTabIdAtom, editorTabsAtom } from "@/context/collections-context";
import type { EditorTab } from "@/types/workspace/editor-state.type";

const MAX_TABS = 50;

function nextActiveId(
  tabs: EditorTab[],
  closedIds: Set<string>,
  activeId: string | null,
) {
  if (!activeId || !closedIds.has(activeId)) return activeId;
  const index = tabs.findIndex((tab) => tab.id === activeId);
  const remaining = tabs.filter((tab) => !closedIds.has(tab.id));
  const neighbour = remaining[Math.min(index, remaining.length - 1)];
  return neighbour?.id ?? null;
}

export function useEditorTabs() {
  const [tabs, setTabs] = useAtom(editorTabsAtom);
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom);

  const openTab = useCallback(
    (tab: EditorTab) => {
      setTabs((previous) => {
        if (previous.some((entry) => entry.id === tab.id)) return previous;
        return [...previous, tab].slice(-MAX_TABS);
      });
      setActiveTabId(tab.id);
    },
    [setTabs, setActiveTabId],
  );

  const closeTabs = useCallback(
    (ids: string[]) => {
      const closed = new Set(ids);
      setActiveTabId(nextActiveId(tabs, closed, activeTabId));
      setTabs(tabs.filter((tab) => !closed.has(tab.id)));
    },
    [tabs, activeTabId, setTabs, setActiveTabId],
  );

  const closeTab = useCallback((id: string) => closeTabs([id]), [closeTabs]);

  return {
    tabs,
    activeTabId,
    activeTab: tabs.find((tab) => tab.id === activeTabId) ?? null,
    openTab,
    closeTab,
    closeTabs,
    setActiveTabId,
  };
}
