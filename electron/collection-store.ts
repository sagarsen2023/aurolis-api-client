import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  applyCollectionOp,
  CollectionOpError,
} from "../src/lib/collection-ops.ts";
import {
  fromFiles,
  COLLECTIONS_DIR,
  ENVIRONMENTS_DIR,
  MANIFEST_PATH,
  stableStringify,
  toFilesWithPaths,
  WORKSPACE_FORMAT_VERSION,
} from "../src/lib/workspace-format.ts";
import { applyCollectionOpSchema } from "../src/validators/collection-ops.schema.ts";
import {
  editorUiStateSchema,
  requestDraftsSchema,
  saveDraftsSchema,
  saveUiStateSchema,
} from "../src/validators/editor-state.schema.ts";
import type {
  CollectionOp,
  CollectionOpName,
  CollectionOpResult,
} from "../src/types/workspace/collection-ops.type.ts";
import type { WorkspaceData } from "../src/types/workspace/workspace.type.ts";
import type {
  EditorState,
  EditorUiState,
  RequestDrafts,
} from "../src/types/workspace/editor-state.type.ts";
import type { WorkspaceEntry } from "../src/types/workspace/workspace-store.type.ts";
import {
  copyEnvironmentSecrets,
  forgetEnvironmentSecrets,
  storeEnvironmentSecrets,
} from "./secret-store.ts";
import { stateFile, writeAtomic } from "./user-data.ts";
import {
  findEntry,
  isInside,
  openWorkspace,
  readWorkspaceFiles,
  parseWorkspaceInput,
  WorkspaceError,
} from "./workspace-store.ts";

const ENVIRONMENT_OPS = new Set<CollectionOpName>([
  "create-environment",
  "import-environment",
  "update-environment",
  "duplicate-environment",
  "delete-environment",
  "update-globals",
]);
const MANIFEST_OPS = new Set<CollectionOpName>([
  "update-workspace",
  "set-default-environment",
  "delete-environment",
]);
const GENERATED_ID_PREFIX = "generated-";
const DRAFTS_FILE = "drafts.json";
const UI_FILE = "ui.json";
const MAX_STATE_BYTES = 5 * 1024 * 1024;

const EMPTY_UI: EditorUiState = {
  tabs: [],
  activeTabId: null,
  environmentId: null,
};

type FileChanges = { writes: Record<string, string>; deletes: string[] };

const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(workspaceId: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(workspaceId) ?? Promise.resolve();
  const next = previous.then(task, task);
  const settled = next.then(
    () => undefined,
    () => undefined,
  );
  queues.set(workspaceId, settled);
  void settled.then(() => {
    if (queues.get(workspaceId) === settled) queues.delete(workspaceId);
  });
  return next;
}

function workspaceRoot(entry: WorkspaceEntry) {
  if (!existsSync(entry.repoDir)) throw new WorkspaceError("missing_folder");
  return path.join(entry.repoDir, entry.root);
}

function areaDir(op: CollectionOp) {
  return ENVIRONMENT_OPS.has(op.op) ? ENVIRONMENTS_DIR : COLLECTIONS_DIR;
}

function isInArea(relative: string, op: CollectionOp) {
  return relative.startsWith(`${areaDir(op)}/`);
}

function isWritable(relative: string, op: CollectionOp) {
  if (relative === MANIFEST_PATH) return MANIFEST_OPS.has(op.op);
  return isInArea(relative, op);
}

function generatedPaths(paths: Record<string, string>, keepId: string | null) {
  return new Set(
    Object.entries(paths)
      .filter(([id]) => id.startsWith(GENERATED_ID_PREFIX) && id !== keepId)
      .map(([, file]) => file),
  );
}

function updatedNodeId(op: CollectionOp) {
  if (op.op === "update-collection" || op.op === "update-folder") return op.id;
  return null;
}

type Serialized = {
  files: Record<string, string>;
  paths: Record<string, string>;
};

function planChanges(
  onDisk: Record<string, string>,
  baseline: Serialized,
  after: Serialized,
  op: CollectionOp,
): FileChanges {
  const skipped = generatedPaths(after.paths, updatedNodeId(op));
  const writes: Record<string, string> = {};
  for (const [file, content] of Object.entries(after.files)) {
    if (!isWritable(file, op) || skipped.has(file)) continue;
    if (baseline.files[file] === content) continue;
    if (file in onDisk && !(file in baseline.files)) {
      throw new WorkspaceError(
        "invalid_input",
        `${file} already exists but Aurolis couldn't read it. Fix or remove that file first.`,
      );
    }
    writes[file] = content;
  }
  const deletes = Object.keys(baseline.files).filter(
    (file) => isInArea(file, op) && file in onDisk && !(file in after.files),
  );
  return { writes, deletes };
}

function resolveInside(rootDir: string, relative: string, op: CollectionOp) {
  const absolute = path.resolve(rootDir, ...relative.split("/"));
  if (relative === MANIFEST_PATH) return absolute;
  const area = path.join(rootDir, areaDir(op));
  if (!isInside(absolute, area) || absolute === area) {
    throw new WorkspaceError("invalid_input", `Refused to touch ${relative}.`);
  }
  return absolute;
}

async function isEmptyDirectory(dir: string) {
  try {
    const entries = await readdir(dir);
    return entries.length === 0;
  } catch {
    return false;
  }
}

async function removeEmptyParents(
  rootDir: string,
  file: string,
  op: CollectionOp,
) {
  const area = path.join(rootDir, areaDir(op));
  let dir = path.dirname(file);
  while (isInside(dir, area) && dir !== area) {
    const empty = await isEmptyDirectory(dir);
    if (!empty) return;
    await rmdir(dir);
    dir = path.dirname(dir);
  }
}

async function applyChanges(
  rootDir: string,
  changes: FileChanges,
  op: CollectionOp,
) {
  for (const [file, content] of Object.entries(changes.writes)) {
    await writeAtomic(resolveInside(rootDir, file, op), content);
  }
  const removed = changes.deletes.map((file) =>
    resolveInside(rootDir, file, op),
  );
  for (const file of removed) await rm(file, { force: true });
  for (const file of removed) await removeEmptyParents(rootDir, file, op);
}

function assertEditable(files: Record<string, string>) {
  if (!(MANIFEST_PATH in files)) throw new WorkspaceError("not_a_workspace");
  const parsed = fromFiles(files);
  if (parsed.workspace.manifest.format > WORKSPACE_FORMAT_VERSION) {
    throw new WorkspaceError("newer_format");
  }
  return parsed;
}

async function syncSecrets(
  workspaceId: string,
  op: CollectionOp,
  applied: { workspace: WorkspaceData; createdId: string | null },
) {
  switch (op.op) {
    case "update-environment":
      await storeEnvironmentSecrets(
        workspaceId,
        applied.workspace.environments.filter((entry) => entry.id === op.id),
      );
      return;
    case "update-globals":
      if (applied.workspace.globals) {
        await storeEnvironmentSecrets(workspaceId, [applied.workspace.globals]);
      }
      return;
    case "import-environment":
      await storeEnvironmentSecrets(
        workspaceId,
        applied.workspace.environments.filter(
          (entry) => entry.id === applied.createdId,
        ),
      );
      return;
    case "duplicate-environment":
      if (applied.createdId) {
        await copyEnvironmentSecrets(workspaceId, op.id, applied.createdId);
      }
      return;
    case "delete-environment":
      await forgetEnvironmentSecrets(workspaceId, op.id);
      return;
    default:
      return;
  }
}

async function runOperation(
  entry: WorkspaceEntry,
  op: CollectionOp,
): Promise<CollectionOpResult> {
  const rootDir = workspaceRoot(entry);
  const { files } = await readWorkspaceFiles(rootDir);
  const parsed = assertEditable(files);
  let applied;
  try {
    applied = applyCollectionOp(parsed.workspace, op, randomUUID);
  } catch (error) {
    if (error instanceof CollectionOpError) {
      throw new WorkspaceError("item_not_found", error.message);
    }
    throw error;
  }
  const options = { previousPaths: parsed.paths };
  const baseline = toFilesWithPaths(parsed.workspace, options);
  const serialized = toFilesWithPaths(applied.workspace, options);
  const changes = planChanges(files, baseline, serialized, op);
  await applyChanges(rootDir, changes, op);
  await syncSecrets(entry.id, op, applied);
  const workspace = await openWorkspace(entry.id);
  return { workspace, createdId: applied.createdId };
}

export async function applyOperation(
  params: unknown,
): Promise<CollectionOpResult> {
  const { workspaceId, op } = parseWorkspaceInput(
    applyCollectionOpSchema,
    params,
  );
  const entry = await findEntry(workspaceId);
  return enqueue(entry.id, () => runOperation(entry, op as CollectionOp));
}

async function readState<T>(
  file: string,
  schema: z.ZodType<T>,
  fallback: T,
): Promise<T> {
  try {
    const content = await readFile(file, "utf8");
    if (content.length > MAX_STATE_BYTES) return fallback;
    const json: unknown = JSON.parse(content);
    const result = schema.safeParse(json);
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}

async function writeState(file: string, value: unknown) {
  const content = stableStringify(value);
  if (content.length > MAX_STATE_BYTES) {
    throw new WorkspaceError("invalid_input", "Too many unsaved changes.");
  }
  await writeAtomic(file, content);
}

export async function loadEditorState(
  workspaceId: unknown,
): Promise<EditorState> {
  const entry = await findEntry(workspaceId);
  const [drafts, ui] = await Promise.all([
    readState<RequestDrafts>(
      stateFile(entry.id, DRAFTS_FILE),
      requestDraftsSchema as z.ZodType<RequestDrafts>,
      {},
    ),
    readState<EditorUiState>(
      stateFile(entry.id, UI_FILE),
      editorUiStateSchema,
      EMPTY_UI,
    ),
  ]);
  return { drafts, ui };
}

export async function saveDrafts(params: unknown) {
  const { workspaceId, drafts } = parseWorkspaceInput(saveDraftsSchema, params);
  const entry = await findEntry(workspaceId);
  await writeState(stateFile(entry.id, DRAFTS_FILE), drafts);
}

export async function saveUiState(params: unknown) {
  const { workspaceId, ui } = parseWorkspaceInput(saveUiStateSchema, params);
  const entry = await findEntry(workspaceId);
  await writeState(stateFile(entry.id, UI_FILE), ui);
}
