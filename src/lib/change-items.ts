import type {
  ChangedItem,
  ChangedItemKind,
  ChangeGroup,
  ChangeGroupKind,
  ChangeStatus,
} from "../types/workspace/source-control.type.ts";
import type {
  HttpMethod,
  RequestProtocol,
} from "../types/workspace/request.type.ts";

export interface ChangedFileContent {
  path: string;
  status: ChangeStatus;
  content: string | null;
}

export interface KnownCollection {
  id: string;
  name: string;
}

export interface KnownNames {
  collections: Record<string, KnownCollection>;
  folders: Record<string, string>;
  requests: Record<string, string>;
}

type ItemMeta = {
  id?: unknown;
  name?: unknown;
  protocol?: unknown;
  method?: unknown;
};

type DraftItem = ChangedItem & { id: string | null; groupDir: string | null };

const COLLECTIONS = "collections";
const ENVIRONMENTS = "environments";
const MANIFEST = "aurolis.json";
const KIND_ORDER: ChangedItemKind[] = [
  "workspace",
  "collection",
  "folder",
  "request",
  "example",
  "globals",
  "environment",
  "file",
];
const GROUP_ORDER: ChangeGroupKind[] = [
  "collection",
  "environments",
  "workspace",
];

const dirOf = (file: string) =>
  file.slice(0, Math.max(file.lastIndexOf("/"), 0));
const baseOf = (file: string) => file.slice(file.lastIndexOf("/") + 1);

function parseMeta(content: string | null): ItemMeta {
  if (!content) return {};
  try {
    const value: unknown = JSON.parse(content);
    return value && typeof value === "object" ? (value as ItemMeta) : {};
  } catch {
    return {};
  }
}

function kindOf(file: string): ChangedItemKind {
  if (file === MANIFEST) return "workspace";
  if (file.startsWith(`${ENVIRONMENTS}/`)) {
    return baseOf(file) === "_globals.env.json" ? "globals" : "environment";
  }
  if (!file.startsWith(`${COLLECTIONS}/`)) return "file";
  if (file.endsWith("/_collection.json")) return "collection";
  if (file.endsWith("/_folder.json")) return "folder";
  if (file.endsWith(".req.json")) return "request";
  if (dirOf(file).endsWith(".examples")) return "example";
  return "file";
}

function collectionDir(file: string) {
  const parts = file.split("/");
  return parts[0] === COLLECTIONS && parts.length > 2
    ? `${parts[0]}/${parts[1]}`
    : null;
}

function ownDir(file: string, kind: ChangedItemKind) {
  const dir = dirOf(file);
  if (kind === "collection" || kind === "folder") return dirOf(dir);
  if (kind === "example") return dirOf(dir);
  return dir;
}

function locationOf(
  file: string,
  kind: ChangedItemKind,
  known: KnownNames,
): string[] {
  const groupDir = collectionDir(file);
  if (!groupDir) return [];
  const location: string[] = [];
  const segments = ownDir(file, kind).split("/").slice(2);
  let dir = groupDir;
  for (const segment of segments) {
    dir = `${dir}/${segment}`;
    location.push(known.folders[dir] ?? segment);
  }
  if (kind === "example") {
    const requestFile = `${dirOf(file).replace(/\.examples$/, "")}.req.json`;
    location.push(known.requests[requestFile] ?? baseOf(requestFile));
  }
  return location;
}

function fallbackName(file: string, kind: ChangedItemKind) {
  if (kind === "workspace") return "Workspace settings";
  if (kind === "globals") return "Globals";
  if (kind === "collection" || kind === "folder") return baseOf(dirOf(file));
  return baseOf(file).replace(/(\.req|\.env)?\.json$/, "");
}

function textOf(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function toDraftItem(file: ChangedFileContent, known: KnownNames): DraftItem {
  const kind = kindOf(file.path);
  const meta = parseMeta(file.content);
  const isRequest = kind === "request";
  const protocol = isRequest
    ? ((textOf(meta.protocol) ?? "http") as RequestProtocol)
    : null;
  return {
    key: file.path,
    id: textOf(meta.id),
    kind,
    name: textOf(meta.name) ?? fallbackName(file.path, kind),
    previousName: null,
    status: file.status,
    location: locationOf(file.path, kind, known),
    protocol,
    method:
      protocol === "http"
        ? ((textOf(meta.method) ?? "GET") as HttpMethod)
        : null,
    groupDir: collectionDir(file.path),
  };
}

function pairKey(item: DraftItem) {
  return item.id ? `${item.kind}:${item.id}` : null;
}

function mergeMoves(items: DraftItem[]): DraftItem[] {
  const added = new Map<string, DraftItem>();
  for (const item of items) {
    const key = pairKey(item);
    if (key && item.status === "added") added.set(key, item);
  }
  const merged: DraftItem[] = [];
  const consumed = new Set<DraftItem>();
  for (const item of items) {
    const key = pairKey(item);
    const partner =
      key && item.status === "deleted" ? added.get(key) : undefined;
    if (!partner) continue;
    consumed.add(item).add(partner);
    const renamed = partner.name !== item.name;
    merged.push({
      ...partner,
      status: renamed ? "renamed" : "modified",
      previousName: renamed ? item.name : null,
    });
  }
  return [...items.filter((item) => !consumed.has(item)), ...merged];
}

function collectionsByDir(items: DraftItem[], known: KnownNames) {
  const currentNames = new Map(
    Object.values(known.collections).map((entry) => [entry.id, entry.name]),
  );
  const byDir: Record<string, KnownCollection> = { ...known.collections };
  for (const item of items) {
    if (item.kind !== "collection" || !item.groupDir || !item.id) continue;
    byDir[item.groupDir] ??= {
      id: item.id,
      name: currentNames.get(item.id) ?? item.name,
    };
  }
  return byDir;
}

function groupOf(
  item: DraftItem,
  collections: Record<string, KnownCollection>,
): { key: string; kind: ChangeGroupKind; name: string } {
  if (item.groupDir) {
    const collection = collections[item.groupDir];
    return {
      key: `collection:${collection?.id ?? item.groupDir}`,
      kind: "collection",
      name: collection?.name ?? baseOf(item.groupDir),
    };
  }
  if (item.kind === "environment" || item.kind === "globals") {
    return { key: "environments", kind: "environments", name: "Environments" };
  }
  return { key: "workspace", kind: "workspace", name: "Workspace" };
}

function compareItems(a: ChangedItem, b: ChangedItem) {
  return (
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
    a.location.join("/").localeCompare(b.location.join("/")) ||
    a.name.localeCompare(b.name)
  );
}

function compareGroups(a: ChangeGroup, b: ChangeGroup) {
  return (
    GROUP_ORDER.indexOf(a.kind) - GROUP_ORDER.indexOf(b.kind) ||
    a.name.localeCompare(b.name)
  );
}

function toChangedItem(item: DraftItem): ChangedItem {
  const { id: _id, groupDir: _groupDir, ...changed } = item;
  return changed;
}

export function describeChanges(
  files: ChangedFileContent[],
  known: KnownNames,
): ChangeGroup[] {
  const items = mergeMoves(files.map((file) => toDraftItem(file, known)));
  const collections = collectionsByDir(items, known);
  const groups = new Map<string, ChangeGroup>();
  for (const item of items) {
    const { key, kind, name } = groupOf(item, collections);
    const group = groups.get(key) ?? { key, kind, name, items: [] };
    group.items.push(toChangedItem(item));
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, items: group.items.sort(compareItems) }))
    .sort(compareGroups);
}
