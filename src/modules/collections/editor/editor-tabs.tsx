import { useAtomValue } from "jotai";
import { FileText, Folder as FolderIcon, Layers, X } from "lucide-react";
import { draftsAtom } from "@/context/collections-context";
import { activeWorkspaceAtom } from "@/context/workspace-context";
import { useEditorTabs } from "@/hooks/use-editor-tabs";
import {
  findCollectionById,
  findExampleById,
  findFolderById,
  findRequestById,
} from "@/lib/collection-ops";
import { cn } from "@/lib/utils";
import type {
  EditorTab,
  RequestDrafts,
} from "@/types/workspace/editor-state.type";
import type { WorkspaceData } from "@/types/workspace/workspace.type";
import type { ReactNode } from "react";
import RequestBadge from "../shared/request-badge";

type TabLabel = { title: string; icon: ReactNode };

function labelFor(
  data: WorkspaceData | null,
  tab: EditorTab,
  drafts: RequestDrafts,
): TabLabel | null {
  switch (tab.kind) {
    case "request": {
      const request = findRequestById(data, tab.id);
      if (!request) return null;
      const current = drafts[tab.id] ?? request;
      return {
        title: current.name,
        icon: <RequestBadge request={current} className="w-auto" />,
      };
    }
    case "example": {
      const found = findExampleById(data, tab.id);
      if (!found) return null;
      return {
        title: found.example.name,
        icon: <FileText className="size-3.5 text-dim" aria-hidden />,
      };
    }
    case "collection": {
      const collection = findCollectionById(data, tab.id);
      if (!collection) return null;
      return {
        title: collection.name,
        icon: <Layers className="size-3.5 text-vio" aria-hidden />,
      };
    }
    case "folder": {
      const folder = findFolderById(data, tab.id);
      if (!folder) return null;
      return {
        title: folder.name,
        icon: <FolderIcon className="size-3.5 text-dim" aria-hidden />,
      };
    }
  }
}

function EditorTabs() {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const drafts = useAtomValue(draftsAtom);
  const { tabs, activeTabId, setActiveTabId, closeTab } = useEditorTabs();
  const data = workspace?.data ?? null;

  if (tabs.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="Open items"
      className="flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-line bg-surface-2"
    >
      {tabs.map((tab) => {
        const label = labelFor(data, tab, drafts);
        if (!label) return null;
        const active = tab.id === activeTabId;
        const dirty = tab.id in drafts;
        return (
          <div
            key={tab.id}
            className={cn(
              "group/tab relative flex max-w-56 shrink-0 items-center border-r border-line",
              active
                ? "bg-background text-foreground"
                : "text-mute hover:bg-surface-hover",
            )}
          >
            {active ? (
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-0.5 bg-vio"
              />
            ) : null}
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTabId(tab.id)}
              onAuxClick={(event) => {
                if (event.button === 1) closeTab(tab.id);
              }}
              className="flex h-full min-w-0 items-center gap-1.5 pr-1 pl-3 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              {label.icon}
              <span className="truncate">{label.title}</span>
            </button>
            <button
              type="button"
              aria-label={`Close ${label.title}${dirty ? " (unsaved changes are kept)" : ""}`}
              onClick={() => closeTab(tab.id)}
              className="relative mr-1.5 grid size-5 shrink-0 place-items-center rounded text-dim outline-none hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            >
              {dirty ? (
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-vio group-hover/tab:hidden"
                />
              ) : null}
              <X
                aria-hidden
                className={cn(
                  "size-3.5",
                  dirty && "hidden group-hover/tab:block",
                )}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default EditorTabs;
