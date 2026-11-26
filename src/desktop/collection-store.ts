import { z } from "zod";
import { applyCollectionOp, CollectionOpError } from "@/lib/collection-ops";
import {
  COLLECTIONS_DIR,
  ENVIRONMENTS_DIR,
  fromFiles,
  MANIFEST_PATH,
  stableStringify,
  toFilesWithPaths,
  WORKSPACE_FORMAT_VERSION,
} from "@/lib/workspace-format";
import {
  applyCollectionOpSchema,
  moveCollectionSchema,
} from "@/validators/collection-ops.schema";
import {
  editorUiStateSchema,
  requestDraftsSchema,
  saveDraftsSchema,
  saveUiStateSchema,
} from "@/validators/editor-state.schema";
import type {
  CollectionOp,
  CollectionOpName,
  CollectionOpResult,
  MoveCollectionResult,
} from "@/types/workspace/collection-ops.type";
import type {
  EditorState,
  EditorUiState,
  RequestDrafts,
} from "@/types/workspace/editor-state.type";
import type { WorkspaceData } from "@/types/workspace/workspace.type";
import { run } from "./invoke";
import { BridgeError } from "./results";
import { secretsOf, type WorkspaceSecrets } from "./secrets";
import {
  createWorkspace,
  findEntry,
  openWorkspace,
  readWorkspaceFiles,
} from "./workspace-data";

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
const MAX_STATE_BYTES = 5 * 1024 * 1024;

const EMPTY_UI: EditorUiState = {
  tabs: [],
  activeTabId: null,
  environmentId: null,
};

type Serialized = {
  files: Record<string, string>;
  paths: Record<string, string>;
};

type FileChanges = {
  area: string;
  writes: Record<string, string>;
  deletes: string[];
  manifest?: string;
};

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

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BridgeError("invalid_input", z.prettifyError(parsed.error));
  }
  return parsed.data;
}

const areaOf = (op: CollectionOp) =>
  ENVIRONMENT_OPS.has(op.op) ? ENVIRONMENTS_DIR : COLLECTIONS_DIR;

const isInArea = (file: string, op: CollectionOp) =>
  file.startsWith(`${areaOf(op)}/`);

function isWritable(file: string, op: CollectionOp) {
  if (file === MANIFEST_PATH) return MANIFEST_OPS.has(op.op);
  return isInArea(file, op);
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

function planChanges(
  onDisk: Record<string, string>,
  baseline: Serialized,
  after: Serialized,
  op: CollectionOp,
): FileChanges {
  const skipped = generatedPaths(after.paths, updatedNodeId(op));
  const changes: FileChanges = { area: areaOf(op), writes: {}, deletes: [] };
  for (const [file, content] of Object.entries(after.files)) {
    if (!isWritable(file, op) || skipped.has(file)) continue;
    if (baseline.files[file] === content) continue;
    if (file in onDisk && !(file in baseline.files)) {
      throw new BridgeError(
        "invalid_input",
        `${file} already exists but Aurolis couldn't read it. Fix or remove that file first.`,
      );
    }
    if (file === MANIFEST_PATH) changes.manifest = content;
    else changes.writes[file] = content;
  }
  changes.deletes = Object.keys(baseline.files).filter(
    (file) => isInArea(file, op) && file in onDisk && !(file in after.files),
  );
  return changes;
}

function assertEditable(files: Record<string, string>) {
  if (!(MANIFEST_PATH in files)) throw new BridgeError("not_a_workspace");
  const parsed = fromFiles(files);
  if (parsed.workspace.manifest.format > WORKSPACE_FORMAT_VERSION) {
    throw new BridgeError("newer_format");
  }
  return parsed;
}

async function updateSecrets(
  workspaceId: string,
  set: WorkspaceSecrets,
  remove: string[] = [],
) {
  await run<null>("secrets_update", { workspaceId, set, remove });
}

async function syncSecrets(
  workspaceId: string,
  op: CollectionOp,
  applied: { workspace: WorkspaceData; createdId: string | null },
  stored: () => Promise<WorkspaceSecrets>,
) {
  const environments = applied.workspace.environments;
  switch (op.op) {
    case "update-environment":
    case "import-environment": {
      const id = op.op === "update-environment" ? op.id : applied.createdId;
      const environment = environments.find((entry) => entry.id === id);
      if (environment) {
        await updateSecrets(workspaceId, {
          [environment.id]: secretsOf(environment),
        });
      }
      return;
    }
    case "update-globals":
      if (applied.workspace.globals) {
        const globals = applied.workspace.globals;
        await updateSecrets(workspaceId, { [globals.id]: secretsOf(globals) });
      }
      return;
    case "duplicate-environment": {
      if (!applied.createdId) return;
      const source = (await stored())[op.id];
      if (source)
        await updateSecrets(workspaceId, {
          [applied.createdId]: { ...source },
        });
      return;
    }
    case "delete-environment":
      await updateSecrets(workspaceId, {}, [op.id]);
      return;
    default:
      return;
  }
}

async function writeOperation(workspaceId: string, op: CollectionOp) {
  const { files } = await readWorkspaceFiles(workspaceId);
  const parsed = assertEditable(files);
  let applied;
  try {
    applied = applyCollectionOp(parsed.workspace, op, () =>
      crypto.randomUUID(),
    );
  } catch (error) {
    if (error instanceof CollectionOpError) {
      throw new BridgeError("item_not_found", error.message);
    }
    throw error;
  }
  const options = { previousPaths: parsed.paths };
  const baseline = toFilesWithPaths(parsed.workspace, options);
  const serialized = toFilesWithPaths(applied.workspace, options);
  const changes = planChanges(files, baseline, serialized, op);
  await run<null>("workspace_write_files", { id: workspaceId, changes });
  await syncSecrets(workspaceId, op, applied, () =>
    run<WorkspaceSecrets>("secrets_get", { workspaceId }),
  );
  return applied.createdId;
}

async function runOperation(
  workspaceId: string,
  op: CollectionOp,
): Promise<CollectionOpResult> {
  const createdId = await writeOperation(workspaceId, op);
  const workspace = await openWorkspace(workspaceId);
  return { workspace, createdId };
}

async function readCollection(workspaceId: string, collectionId: string) {
  const { files } = await readWorkspaceFiles(workspaceId);
  const collection = assertEditable(files).workspace.collections.find(
    (item) => item.id === collectionId,
  );
  if (!collection) throw new BridgeError("item_not_found");
  return collection;
}

export function applyOperation(params: unknown): Promise<CollectionOpResult> {
  const { workspaceId, op } = parseInput(applyCollectionOpSchema, params);
  return enqueue(workspaceId, () =>
    runOperation(workspaceId, op as CollectionOp),
  );
}

export async function moveCollection(
  params: unknown,
): Promise<MoveCollectionResult> {
  const { workspaceId, collectionId, target } = parseInput(
    moveCollectionSchema,
    params,
  );
  const source = await findEntry(workspaceId);
  if (target.kind === "existing" && target.workspaceId === source.id) {
    throw new BridgeError(
      "invalid_input",
      "The collection is already in this workspace.",
    );
  }
  const collection = await enqueue(source.id, () =>
    readCollection(source.id, collectionId),
  );
  const destination =
    target.kind === "existing"
      ? await findEntry(target.workspaceId)
      : await findEntry(
          (await createWorkspace(target.name, false)).workspaceId,
        );
  const movedId = await enqueue(destination.id, () =>
    writeOperation(destination.id, { op: "import-collection", collection }),
  );
  const { workspace } = await enqueue(source.id, () =>
    runOperation(source.id, { op: "delete-collection", id: collectionId }),
  );
  return {
    workspace,
    target: { id: destination.id, name: destination.name },
    collectionId: movedId,
  };
}

async function readState<T>(
  workspaceId: string,
  name: "drafts" | "ui",
  schema: z.ZodType<T>,
  fallback: T,
): Promise<T> {
  const content = await run<string | null>("workspace_state_read", {
    id: workspaceId,
    name,
  });
  if (!content) return fallback;
  try {
    const result = schema.safeParse(JSON.parse(content));
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}

async function writeState(
  workspaceId: string,
  name: "drafts" | "ui",
  value: unknown,
) {
  const content = stableStringify(value);
  if (content.length > MAX_STATE_BYTES) {
    throw new BridgeError("invalid_input", "Too many unsaved changes.");
  }
  await run<null>("workspace_state_write", { id: workspaceId, name, content });
}

export async function loadEditorState(
  workspaceId: string,
): Promise<EditorState> {
  const [drafts, ui] = await Promise.all([
    readState<RequestDrafts>(
      workspaceId,
      "drafts",
      requestDraftsSchema as z.ZodType<RequestDrafts>,
      {},
    ),
    readState<EditorUiState>(workspaceId, "ui", editorUiStateSchema, EMPTY_UI),
  ]);
  return { drafts, ui };
}

export async function saveDrafts(params: unknown) {
  const { workspaceId, drafts } = parseInput(saveDraftsSchema, params);
  await writeState(workspaceId, "drafts", drafts);
}

export async function saveUiState(params: unknown) {
  const { workspaceId, ui } = parseInput(saveUiStateSchema, params);
  await writeState(workspaceId, "ui", ui);
}
