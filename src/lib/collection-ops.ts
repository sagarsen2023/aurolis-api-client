import { seqBetween } from "./workspace-format.ts";
import type {
  Collection,
  CollectionItem,
  Folder,
} from "../types/workspace/collection.type.ts";
import type {
  CollectionOp,
  CollectionOpName,
} from "../types/workspace/collection-ops.type.ts";
import type {
  ApiRequest,
  RequestExample,
} from "../types/workspace/request.type.ts";
import type { WorkspaceData } from "../types/workspace/workspace.type.ts";
import { createRequest } from "./request-factory.ts";

export class CollectionOpError extends Error {
  readonly code: "item_not_found";

  constructor(message: string) {
    super(message);
    this.name = "CollectionOpError";
    this.code = "item_not_found";
  }
}

type LocatedItem = {
  item: CollectionItem;
  siblings: CollectionItem[];
};

type LocatedExample = {
  example: RequestExample;
  request: ApiRequest;
};

type OpOf<K extends CollectionOpName> = Extract<CollectionOp, { op: K }>;

type OpHandler<K extends CollectionOpName> = (
  workspace: WorkspaceData,
  op: OpOf<K>,
  newId: () => string,
) => string | null;

function nextSeq(list: ReadonlyArray<{ seq: number }>) {
  if (list.length === 0) return seqBetween();
  const last = Math.max(...list.map((entry) => entry.seq));
  return seqBetween(last);
}

function seqAfter(list: ReadonlyArray<{ seq: number }>, seq: number) {
  const following = list
    .map((entry) => entry.seq)
    .filter((value) => value > seq)
    .sort((a, b) => a - b);
  return seqBetween(seq, following[0]);
}

function locateItem(items: CollectionItem[], id: string): LocatedItem | null {
  for (const item of items) {
    if (item.id === id) return { item, siblings: items };
    if (item.type !== "folder") continue;
    const found = locateItem(item.items, id);
    if (found) return found;
  }
  return null;
}

function findItem(workspace: WorkspaceData, id: string): LocatedItem | null {
  for (const collection of workspace.collections) {
    const found = locateItem(collection.items, id);
    if (found) return found;
  }
  return null;
}

function requireCollection(workspace: WorkspaceData, id: string) {
  const collection = workspace.collections.find((entry) => entry.id === id);
  if (!collection) throw new CollectionOpError("Collection not found.");
  return collection;
}

function requireFolder(workspace: WorkspaceData, id: string) {
  const found = findItem(workspace, id);
  if (found?.item.type !== "folder") {
    throw new CollectionOpError("Folder not found.");
  }
  return { folder: found.item, siblings: found.siblings };
}

function requireRequest(workspace: WorkspaceData, id: string) {
  const found = findItem(workspace, id);
  if (found?.item.type !== "request") {
    throw new CollectionOpError("Request not found.");
  }
  return { request: found.item, siblings: found.siblings };
}

function requireContainer(workspace: WorkspaceData, id: string) {
  const collection = workspace.collections.find((entry) => entry.id === id);
  if (collection) return collection.items;
  return requireFolder(workspace, id).folder.items;
}

function findExample(
  workspace: WorkspaceData,
  id: string,
): LocatedExample | null {
  const visit = (items: CollectionItem[]): LocatedExample | null => {
    for (const item of items) {
      const found =
        item.type === "folder" ? visit(item.items) : locateExample(item, id);
      if (found) return found;
    }
    return null;
  };
  for (const collection of workspace.collections) {
    const found = visit(collection.items);
    if (found) return found;
  }
  return null;
}

function locateExample(request: ApiRequest, id: string) {
  const example = request.examples.find((entry) => entry.id === id);
  return example ? { example, request } : null;
}

function requireExample(workspace: WorkspaceData, id: string) {
  const found = findExample(workspace, id);
  if (!found) throw new CollectionOpError("Example not found.");
  return found;
}

function remove<T extends { id: string }>(list: T[], id: string) {
  const index = list.findIndex((entry) => entry.id === id);
  if (index >= 0) list.splice(index, 1);
}

function copyName(name: string, siblings: ReadonlyArray<{ name: string }>) {
  const taken = new Set(siblings.map((entry) => entry.name));
  let candidate = `${name} copy`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${name} copy ${n}`;
  return candidate;
}

function cloneRequest(source: ApiRequest, newId: () => string): ApiRequest {
  const copy = structuredClone(source);
  copy.id = newId();
  copy.examples = copy.examples.map((example) => ({
    ...example,
    id: newId(),
  }));
  if (copy.protocol === "websocket" || copy.protocol === "socketio") {
    copy.messages = copy.messages.map((message) => ({
      ...message,
      id: newId(),
    }));
  }
  return copy;
}

const updateWorkspace: OpHandler<"update-workspace"> = (workspace, op) => {
  workspace.manifest.description = op.description;
  return null;
};

const createCollection: OpHandler<"create-collection"> = (
  workspace,
  op,
  newId,
) => {
  const collection: Collection = {
    id: newId(),
    name: op.name,
    seq: nextSeq(workspace.collections),
    description: op.description,
    auth: { type: "none" },
    variables: [],
    items: [],
  };
  workspace.collections.push(collection);
  return collection.id;
};

const updateCollection: OpHandler<"update-collection"> = (workspace, op) => {
  const collection = requireCollection(workspace, op.id);
  Object.assign(collection, op.settings);
  return null;
};

const deleteCollection: OpHandler<"delete-collection"> = (workspace, op) => {
  requireCollection(workspace, op.id);
  remove(workspace.collections, op.id);
  return null;
};

const createFolder: OpHandler<"create-folder"> = (workspace, op, newId) => {
  const items = requireContainer(workspace, op.parentId);
  const folder: Folder = {
    type: "folder",
    id: newId(),
    name: op.name,
    seq: nextSeq(items),
    description: "",
    auth: { type: "inherit" },
    items: [],
  };
  items.push(folder);
  return folder.id;
};

const updateFolder: OpHandler<"update-folder"> = (workspace, op) => {
  const { folder } = requireFolder(workspace, op.id);
  Object.assign(folder, op.settings);
  return null;
};

const deleteFolder: OpHandler<"delete-folder"> = (workspace, op) => {
  const { siblings } = requireFolder(workspace, op.id);
  remove(siblings, op.id);
  return null;
};

const createRequestItem: OpHandler<"create-request"> = (
  workspace,
  op,
  newId,
) => {
  const items = requireContainer(workspace, op.parentId);
  const request = createRequest(op.protocol, {
    id: newId(),
    name: op.name,
    seq: nextSeq(items),
  });
  items.push(request);
  return request.id;
};

const saveRequest: OpHandler<"save-request"> = (workspace, op) => {
  const { request, siblings } = requireRequest(workspace, op.request.id);
  const saved: ApiRequest = {
    ...op.request,
    type: "request",
    seq: request.seq,
    examples: request.examples,
  };
  const index = siblings.indexOf(request);
  siblings[index] = saved;
  return null;
};

const duplicateRequest: OpHandler<"duplicate-request"> = (
  workspace,
  op,
  newId,
) => {
  const { request, siblings } = requireRequest(workspace, op.id);
  const copy = cloneRequest(request, newId);
  copy.name = copyName(request.name, siblings);
  copy.seq = seqAfter(siblings, request.seq);
  siblings.push(copy);
  return copy.id;
};

const deleteRequest: OpHandler<"delete-request"> = (workspace, op) => {
  const { siblings } = requireRequest(workspace, op.id);
  remove(siblings, op.id);
  return null;
};

const createExample: OpHandler<"create-example"> = (workspace, op, newId) => {
  const { request } = requireRequest(workspace, op.requestId);
  const example: RequestExample = {
    ...op.example,
    id: newId(),
    seq: nextSeq(request.examples),
  };
  request.examples.push(example);
  return example.id;
};

const updateExample: OpHandler<"update-example"> = (workspace, op) => {
  const { example } = requireExample(workspace, op.id);
  Object.assign(example, op.example);
  return null;
};

const deleteExample: OpHandler<"delete-example"> = (workspace, op) => {
  const { request } = requireExample(workspace, op.id);
  remove(request.examples, op.id);
  return null;
};

const HANDLERS: { [K in CollectionOpName]: OpHandler<K> } = {
  "update-workspace": updateWorkspace,
  "create-collection": createCollection,
  "update-collection": updateCollection,
  "delete-collection": deleteCollection,
  "create-folder": createFolder,
  "update-folder": updateFolder,
  "delete-folder": deleteFolder,
  "create-request": createRequestItem,
  "save-request": saveRequest,
  "duplicate-request": duplicateRequest,
  "delete-request": deleteRequest,
  "create-example": createExample,
  "update-example": updateExample,
  "delete-example": deleteExample,
};

export function applyCollectionOp(
  workspace: WorkspaceData,
  op: CollectionOp,
  newId: () => string,
): { workspace: WorkspaceData; createdId: string | null } {
  const next = structuredClone(workspace);
  const handler = HANDLERS[op.op] as OpHandler<CollectionOpName>;
  const createdId = handler(next, op, newId);
  return { workspace: next, createdId };
}

export function findRequestById(
  workspace: WorkspaceData | null,
  id: string,
): ApiRequest | null {
  if (!workspace) return null;
  const found = findItem(workspace, id);
  return found?.item.type === "request" ? found.item : null;
}

export function findExampleById(
  workspace: WorkspaceData | null,
  id: string,
): LocatedExample | null {
  if (!workspace) return null;
  return findExample(workspace, id);
}

export function countItems(items: CollectionItem[]): {
  folders: number;
  requests: number;
} {
  let folders = 0;
  let requests = 0;
  for (const item of items) {
    if (item.type === "request") {
      requests += 1;
      continue;
    }
    const nested = countItems(item.items);
    folders += 1 + nested.folders;
    requests += nested.requests;
  }
  return { folders, requests };
}

export interface RequestLocation {
  collection: Collection;
  folders: Folder[];
  request: ApiRequest;
}

function locatePath(
  items: CollectionItem[],
  id: string,
  folders: Folder[],
): { folders: Folder[]; request: ApiRequest } | null {
  for (const item of items) {
    if (item.type === "request") {
      if (item.id === id) return { folders, request: item };
      continue;
    }
    const found = locatePath(item.items, id, [...folders, item]);
    if (found) return found;
  }
  return null;
}

export function locateRequest(
  workspace: WorkspaceData | null,
  id: string,
): RequestLocation | null {
  if (!workspace) return null;
  for (const collection of workspace.collections) {
    const found = locatePath(collection.items, id, []);
    if (found) return { collection, ...found };
  }
  return null;
}

export function findFolderById(
  workspace: WorkspaceData | null,
  id: string,
): Folder | null {
  if (!workspace) return null;
  const found = findItem(workspace, id);
  return found?.item.type === "folder" ? found.item : null;
}

export function findCollectionById(
  workspace: WorkspaceData | null,
  id: string,
): Collection | null {
  return workspace?.collections.find((entry) => entry.id === id) ?? null;
}

export interface FolderLocation {
  collection: Collection;
  folders: Folder[];
  folder: Folder;
}

function locateFolderPath(
  items: CollectionItem[],
  id: string,
  folders: Folder[],
): { folders: Folder[]; folder: Folder } | null {
  for (const item of items) {
    if (item.type !== "folder") continue;
    if (item.id === id) return { folders, folder: item };
    const found = locateFolderPath(item.items, id, [...folders, item]);
    if (found) return found;
  }
  return null;
}

export function locateFolder(
  workspace: WorkspaceData | null,
  id: string,
): FolderLocation | null {
  if (!workspace) return null;
  for (const collection of workspace.collections) {
    const found = locateFolderPath(collection.items, id, []);
    if (found) return { collection, ...found };
  }
  return null;
}
