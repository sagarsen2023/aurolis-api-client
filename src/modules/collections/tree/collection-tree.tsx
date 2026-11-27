import { useMemo, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  Copy,
  FilePlus2,
  FileText,
  Folder as FolderIcon,
  FolderInput,
  FolderPlus,
  Layers,
  Plus,
  Search,
  Settings2,
  Terminal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  activeTabIdAtom,
  draftsAtom,
  expandedNodesAtom,
  treeDialogAtom,
  type TreeDialog,
} from "@/context/collections-context";
import { useCollectionActions } from "@/hooks/use-collection-actions";
import { useEditorTabs } from "@/hooks/use-editor-tabs";
import { handleError } from "@/hooks/usePromise";
import { countItems } from "@/lib/collection-ops";
import { supportsExamples } from "@/lib/request-factory";
import type {
  Collection,
  CollectionItem,
  Folder,
} from "@/types/workspace/collection.type";
import type { ApiRequest } from "@/types/workspace/request.type";
import RequestBadge from "../shared/request-badge";
import type { NodeAction } from "./node-actions";
import TreeRow from "./tree-row";

type Searchable = { name: string };

function matches(item: Searchable, query: string) {
  return item.name.toLowerCase().includes(query);
}

function filterItems(items: CollectionItem[], query: string): CollectionItem[] {
  if (!query) return items;
  const kept: CollectionItem[] = [];
  for (const item of items) {
    if (item.type === "request") {
      if (matches(item, query)) kept.push(item);
      continue;
    }
    if (matches(item, query)) {
      kept.push(item);
      continue;
    }
    const children = filterItems(item.items, query);
    if (children.length > 0) kept.push({ ...item, items: children });
  }
  return kept;
}

function filterCollections(collections: Collection[], query: string) {
  if (!query) return collections;
  return collections.flatMap((collection) => {
    if (matches(collection, query)) return [collection];
    const items = filterItems(collection.items, query);
    return items.length > 0 ? [{ ...collection, items }] : [];
  });
}

function describeContents(items: CollectionItem[]) {
  const { folders, requests } = countItems(items);
  if (folders === 0 && requests === 0) return null;
  const parts = [
    requests > 0
      ? `${requests} ${requests === 1 ? "request" : "requests"}`
      : null,
    folders > 0 ? `${folders} ${folders === 1 ? "folder" : "folders"}` : null,
  ].filter(Boolean);
  return `It contains ${parts.join(" and ")}.`;
}

function useTreeState(searching: boolean) {
  const [expanded, setExpanded] = useAtom(expandedNodesAtom);
  const isExpanded = (id: string, fallback: boolean) =>
    searching || (expanded[id] ?? fallback);
  const toggle = (id: string, fallback: boolean) =>
    setExpanded((current) => ({
      ...current,
      [id]: !(current[id] ?? fallback),
    }));
  const setBranch = (ids: string[], open: boolean) =>
    setExpanded((current) => {
      const next = { ...current };
      for (const id of ids) next[id] = open;
      return next;
    });
  return { isExpanded, toggle, setBranch };
}

function branchIds(id: string, items: CollectionItem[]) {
  const ids = [id];
  const walk = (nodes: CollectionItem[]) => {
    for (const node of nodes) {
      if (node.type !== "folder") continue;
      ids.push(node.id);
      walk(node.items);
    }
  };
  walk(items);
  return ids;
}

type TreeState = ReturnType<typeof useTreeState>;

function containerActions(
  node: { id: string; name: string },
  kind: "collection" | "folder",
  items: CollectionItem[],
  setDialog: (dialog: TreeDialog) => void,
  openSettings: () => void,
): NodeAction[] {
  return [
    {
      label: "New request",
      icon: FilePlus2,
      onSelect: () =>
        setDialog({
          kind: "new-request",
          parentId: node.id,
          parentName: node.name,
        }),
    },
    {
      label: "Import cURL",
      icon: Terminal,
      onSelect: () =>
        setDialog({
          kind: "import-curl",
          parentId: node.id,
          parentName: node.name,
        }),
    },
    {
      label: "New folder",
      icon: FolderPlus,
      onSelect: () =>
        setDialog({
          kind: "new-folder",
          parentId: node.id,
          parentName: node.name,
        }),
    },
    {
      label: kind === "collection" ? "Collection settings" : "Folder settings",
      icon: Settings2,
      onSelect: openSettings,
    },
    ...(kind === "collection"
      ? [
          {
            label: "Move to workspace…",
            icon: FolderInput,
            onSelect: () =>
              setDialog({
                kind: "move-collection",
                id: node.id,
                name: node.name,
              }),
          },
        ]
      : []),
    {
      label: "Delete",
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      onSelect: () =>
        setDialog({
          kind: "delete",
          target: kind,
          id: node.id,
          name: node.name,
          detail: describeContents(items),
        }),
    },
  ];
}

function ExampleRows({
  request,
  depth,
}: Readonly<{ request: ApiRequest; depth: number }>) {
  const activeTabId = useAtomValue(activeTabIdAtom);
  const setDialog = useSetAtom(treeDialogAtom);
  const { openTab } = useEditorTabs();
  return request.examples.map((example) => (
    <TreeRow
      key={example.id}
      depth={depth}
      label={example.name}
      leading={<FileText className="size-3.5 shrink-0 text-dim" aria-hidden />}
      active={activeTabId === example.id}
      onOpen={() =>
        openTab({ kind: "example", id: example.id, requestId: request.id })
      }
      actions={[
        {
          label: "Delete example",
          icon: Trash2,
          destructive: true,
          onSelect: () =>
            setDialog({
              kind: "delete",
              target: "example",
              id: example.id,
              name: example.name,
              detail: null,
            }),
        },
      ]}
    />
  ));
}

function RequestNode({
  request,
  depth,
  tree,
}: Readonly<{ request: ApiRequest; depth: number; tree: TreeState }>) {
  const activeTabId = useAtomValue(activeTabIdAtom);
  const drafts = useAtomValue(draftsAtom);
  const setDialog = useSetAtom(treeDialogAtom);
  const { openTab } = useEditorTabs();
  const { apply } = useCollectionActions();
  const hasExamples = request.examples.length > 0;
  const expanded = hasExamples && tree.isExpanded(request.id, false);
  const current = drafts[request.id] ?? request;

  const duplicate = () => {
    apply({ op: "duplicate-request", id: request.id })
      .then((createdId) => {
        toast.success("Request duplicated");
        if (createdId) openTab({ kind: "request", id: createdId });
      })
      .catch(handleError);
  };

  const actions: NodeAction[] = [
    ...(supportsExamples(request.protocol)
      ? [
          {
            label: "Add example",
            icon: FileText,
            onSelect: () =>
              setDialog({
                kind: "new-example",
                requestId: request.id,
                requestName: request.name,
              }),
          },
        ]
      : []),
    { label: "Duplicate", icon: Copy, onSelect: duplicate },
    {
      label: "Delete",
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      onSelect: () =>
        setDialog({
          kind: "delete",
          target: "request",
          id: request.id,
          name: request.name,
          detail: hasExamples
            ? `Its ${request.examples.length} saved ${request.examples.length === 1 ? "example is" : "examples are"} deleted too.`
            : null,
        }),
    },
  ];

  return (
    <>
      <TreeRow
        depth={depth}
        label={current.name}
        leading={<RequestBadge request={current} />}
        active={activeTabId === request.id}
        dirty={request.id in drafts}
        expanded={expanded}
        onToggle={
          hasExamples ? () => tree.toggle(request.id, false) : undefined
        }
        onOpen={() => openTab({ kind: "request", id: request.id })}
        actions={actions}
      />
      {expanded ? <ExampleRows request={request} depth={depth + 1} /> : null}
    </>
  );
}

function ItemNodes({
  items,
  depth,
  tree,
}: Readonly<{ items: CollectionItem[]; depth: number; tree: TreeState }>) {
  return items.map((item) =>
    item.type === "folder" ? (
      <FolderNode key={item.id} folder={item} depth={depth} tree={tree} />
    ) : (
      <RequestNode key={item.id} request={item} depth={depth} tree={tree} />
    ),
  );
}

function EmptyContainer({ depth }: Readonly<{ depth: number }>) {
  return (
    <p
      className="py-1.5 text-[12px] text-dim"
      style={{ paddingLeft: depth * 14 + 30 }}
    >
      Empty
    </p>
  );
}

function FolderNode({
  folder,
  depth,
  tree,
}: Readonly<{ folder: Folder; depth: number; tree: TreeState }>) {
  const activeTabId = useAtomValue(activeTabIdAtom);
  const setDialog = useSetAtom(treeDialogAtom);
  const { openTab } = useEditorTabs();
  const expanded = tree.isExpanded(folder.id, false);
  const openSettings = () => openTab({ kind: "folder", id: folder.id });

  return (
    <>
      <TreeRow
        depth={depth}
        label={folder.name}
        leading={
          <FolderIcon className="size-3.5 shrink-0 text-dim" aria-hidden />
        }
        active={activeTabId === folder.id}
        expanded={expanded}
        onToggle={() => tree.toggle(folder.id, false)}
        onOpen={() => tree.toggle(folder.id, false)}
        onToggleBranch={() =>
          tree.setBranch(branchIds(folder.id, folder.items), !expanded)
        }
        actions={containerActions(
          folder,
          "folder",
          folder.items,
          setDialog,
          openSettings,
        )}
      />
      {expanded && folder.items.length === 0 ? (
        <EmptyContainer depth={depth + 1} />
      ) : null}
      {expanded ? (
        <ItemNodes items={folder.items} depth={depth + 1} tree={tree} />
      ) : null}
    </>
  );
}

function CollectionNode({
  collection,
  tree,
}: Readonly<{ collection: Collection; tree: TreeState }>) {
  const activeTabId = useAtomValue(activeTabIdAtom);
  const setDialog = useSetAtom(treeDialogAtom);
  const { openTab } = useEditorTabs();
  const expanded = tree.isExpanded(collection.id, false);
  const openSettings = () => openTab({ kind: "collection", id: collection.id });

  return (
    <>
      <TreeRow
        depth={0}
        label={collection.name}
        leading={<Layers className="size-3.5 shrink-0 text-vio" aria-hidden />}
        active={activeTabId === collection.id}
        expanded={expanded}
        onToggle={() => tree.toggle(collection.id, false)}
        onOpen={openSettings}
        onToggleBranch={() =>
          tree.setBranch(branchIds(collection.id, collection.items), !expanded)
        }
        actions={containerActions(
          collection,
          "collection",
          collection.items,
          setDialog,
          openSettings,
        )}
      />
      {expanded && collection.items.length === 0 ? (
        <EmptyContainer depth={1} />
      ) : null}
      {expanded ? (
        <ItemNodes items={collection.items} depth={1} tree={tree} />
      ) : null}
    </>
  );
}

function CollectionTree({
  collections,
}: Readonly<{ collections: Collection[] }>) {
  const [query, setQuery] = useState("");
  const setDialog = useSetAtom(treeDialogAtom);
  const normalized = query.trim().toLowerCase();
  const tree = useTreeState(Boolean(normalized));
  const visible = useMemo(
    () => filterCollections(collections, normalized),
    [collections, normalized],
  );

  return (
    <aside
      aria-label="Collections"
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h2 className="text-[15px] font-medium text-foreground">Collections</h2>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="New collection"
                onClick={() => setDialog({ kind: "new-collection" })}
              />
            }
          >
            <Plus />
          </TooltipTrigger>
          <TooltipContent side="bottom">New collection</TooltipContent>
        </Tooltip>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-dim"
            aria-hidden
          />
          <Input
            aria-label="Search requests"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 pl-9 text-[13px]"
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Collection tree" className="flex flex-col px-2 pb-4">
          {visible.map((collection) => (
            <CollectionNode
              key={collection.id}
              collection={collection}
              tree={tree}
            />
          ))}
          {collections.length === 0 ? (
            <div className="flex flex-col items-start gap-3 px-2 py-4">
              <p className="text-[13px] text-mute">
                No collections yet. A collection groups related requests, like
                one API or service.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialog({ kind: "new-collection" })}
              >
                <Plus />
                New collection
              </Button>
            </div>
          ) : null}
          {collections.length > 0 && visible.length === 0 ? (
            <p className="px-2 py-4 text-[13px] text-mute">
              Nothing matches “{query.trim()}”.
            </p>
          ) : null}
        </nav>
      </ScrollArea>
    </aside>
  );
}

export default CollectionTree;
