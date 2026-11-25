import { z } from "zod";
import {
  collectionFileSchema,
  environmentFileSchema,
  exampleFileSchema,
  folderFileSchema,
  manifestFileSchema,
  requestFileSchema,
} from "../validators/workspace.schema.ts";
import type {
  Collection,
  CollectionItem,
  Folder,
} from "../types/workspace/collection.type.ts";
import type { Environment } from "../types/workspace/environment.type.ts";
import type {
  ApiRequest,
  RequestExample,
} from "../types/workspace/request.type.ts";
import type {
  WorkspaceData,
  WorkspaceManifest,
} from "../types/workspace/workspace.type.ts";
import type {
  FormatIssue,
  ParsedWorkspace,
  ToFilesOptions,
  WorkspaceFiles,
} from "../types/workspace/workspace-format.type.ts";

export const WORKSPACE_FORMAT_VERSION = 1;
export const MANIFEST_PATH = "aurolis.json";

const COLLECTIONS_DIR = "collections";
const ENVIRONMENTS_DIR = "environments";
const COLLECTION_FILE = "_collection.json";
const FOLDER_FILE = "_folder.json";
const GLOBALS_FILE = "_globals.env.json";
const REQUEST_EXT = ".req.json";
const ENVIRONMENT_EXT = ".env.json";
const EXAMPLES_DIR_SUFFIX = ".examples";
const JSON_EXT = ".json";
const SLUG_MAX_LENGTH = 60;
const SEQ_STEP = 1000;
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function sortKeys(value: unknown): Json {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value as Json;
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

export function slugify(name: string, fallback: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
  const base = slug || fallback;
  return WINDOWS_RESERVED_NAMES.test(base) ? `${base}-${fallback}` : base;
}

export function seqBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return SEQ_STEP;
  if (before === undefined) return (after as number) - SEQ_STEP;
  if (after === undefined) return before + SEQ_STEP;
  return (before + after) / 2;
}

export function createManifest(id: string, name: string): WorkspaceManifest {
  return {
    format: WORKSPACE_FORMAT_VERSION,
    workspace: { id, name },
    description: "",
    defaultEnvironment: null,
  };
}

export function isWorkspaceRoot(files: WorkspaceFiles): boolean {
  return MANIFEST_PATH in files;
}

const bySeq = <T extends { seq: number; name: string; id: string }>(
  a: T,
  b: T,
) => a.seq - b.seq || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

const dirOf = (path: string) => path.slice(0, path.lastIndexOf("/"));
const baseOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

type Named = { id: string; name: string; seq: number };

function previousStem(previousPath: string | undefined, ext: string) {
  if (!previousPath) return null;
  if (ext === COLLECTION_FILE || ext === FOLDER_FILE) {
    if (!previousPath.endsWith(`/${ext}`)) return null;
    const dir = dirOf(previousPath);
    return { dir: dirOf(dir), stem: baseOf(dir) };
  }
  if (!previousPath.endsWith(ext)) return null;
  return {
    dir: dirOf(previousPath),
    stem: baseOf(previousPath).slice(0, -ext.length),
  };
}

function assignStems<T extends Named>(
  dir: string,
  items: T[],
  ext: string,
  fallback: string,
  previous: Record<string, string>,
  taken: Set<string> = new Set(),
): Map<string, string> {
  const stems = new Map<string, string>();
  const ordered = [...items].sort(bySeq);
  for (const item of ordered) {
    const base = slugify(item.name, fallback);
    const prior = previousStem(previous[item.id], ext);
    const keepsName =
      prior &&
      prior.dir === dir &&
      new RegExp(`^${base}(-\\d+)?$`).test(prior.stem) &&
      !taken.has(prior.stem);
    if (keepsName) {
      stems.set(item.id, prior.stem);
      taken.add(prior.stem);
    }
  }
  for (const item of ordered) {
    if (stems.has(item.id)) continue;
    const base = slugify(item.name, fallback);
    let stem = base;
    for (let n = 2; taken.has(stem); n++) stem = `${base}-${n}`;
    stems.set(item.id, stem);
    taken.add(stem);
  }
  return stems;
}

function environmentContent(environment: Environment) {
  return stableStringify({
    id: environment.id,
    name: environment.name,
    seq: environment.seq,
    variables: environment.variables.map((variable) => ({
      ...variable,
      value: variable.secret ? "" : variable.value,
    })),
  });
}

export function toFilesWithPaths(
  workspace: WorkspaceData,
  options: ToFilesOptions = {},
): { files: WorkspaceFiles; paths: Record<string, string> } {
  const previous = options.previousPaths ?? {};
  const files: WorkspaceFiles = {};
  const paths: Record<string, string> = {};

  const write = (path: string, content: string, id?: string) => {
    if (path in files) throw new Error(`Two items map to ${path}`);
    if (id !== undefined) {
      if (id in paths) throw new Error(`Duplicate id ${id}`);
      paths[id] = path;
    }
    files[path] = content;
  };

  write(MANIFEST_PATH, stableStringify(workspace.manifest));

  const writeExamples = (dir: string, request: ApiRequest) => {
    const stems = assignStems(
      dir,
      request.examples,
      JSON_EXT,
      "example",
      previous,
    );
    for (const example of request.examples) {
      write(
        join(dir, `${stems.get(example.id)}${JSON_EXT}`),
        stableStringify(example),
        example.id,
      );
    }
  };

  const writeItems = (dir: string, items: CollectionItem[]) => {
    const folders = items.filter(
      (item): item is Folder => item.type === "folder",
    );
    const requests = items.filter(
      (item): item is ApiRequest => item.type === "request",
    );
    const folderStems = assignStems(
      dir,
      folders,
      FOLDER_FILE,
      "folder",
      previous,
    );
    const requestStems = assignStems(
      dir,
      requests,
      REQUEST_EXT,
      "request",
      previous,
    );

    for (const folder of folders) {
      const folderDir = join(dir, folderStems.get(folder.id) as string);
      const { items: children, type: _type, ...meta } = folder;
      write(join(folderDir, FOLDER_FILE), stableStringify(meta), folder.id);
      writeItems(folderDir, children);
    }
    for (const request of requests) {
      const stem = requestStems.get(request.id) as string;
      const { examples: _examples, type: _type, ...meta } = request;
      write(
        join(dir, `${stem}${REQUEST_EXT}`),
        stableStringify(meta),
        request.id,
      );
      writeExamples(join(dir, `${stem}${EXAMPLES_DIR_SUFFIX}`), request);
    }
  };

  const collectionStems = assignStems(
    COLLECTIONS_DIR,
    workspace.collections,
    COLLECTION_FILE,
    "collection",
    previous,
  );
  for (const collection of workspace.collections) {
    const dir = join(
      COLLECTIONS_DIR,
      collectionStems.get(collection.id) as string,
    );
    const { items, ...meta } = collection;
    write(join(dir, COLLECTION_FILE), stableStringify(meta), collection.id);
    writeItems(dir, items);
  }

  const environmentStems = assignStems(
    ENVIRONMENTS_DIR,
    workspace.environments,
    ENVIRONMENT_EXT,
    "environment",
    previous,
  );
  for (const environment of workspace.environments) {
    write(
      join(
        ENVIRONMENTS_DIR,
        `${environmentStems.get(environment.id)}${ENVIRONMENT_EXT}`,
      ),
      environmentContent(environment),
      environment.id,
    );
  }
  if (workspace.globals) {
    write(
      join(ENVIRONMENTS_DIR, GLOBALS_FILE),
      environmentContent(workspace.globals),
      workspace.globals.id,
    );
  }

  const sortedFiles = Object.fromEntries(
    Object.keys(files)
      .sort()
      .map((path) => [path, files[path]]),
  );
  return { files: sortedFiles, paths };
}

export function toFiles(
  workspace: WorkspaceData,
  options: ToFilesOptions = {},
): WorkspaceFiles {
  return toFilesWithPaths(workspace, options).files;
}

type DirNode = {
  dir: string;
  kind: "collection" | "folder";
  collection?: Collection;
  folder?: Folder;
};

const generatedId = (path: string) =>
  `generated-${path.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;

export function fromFiles(files: WorkspaceFiles): ParsedWorkspace {
  const issues: FormatIssue[] = [];
  const paths: Record<string, string> = {};
  const usedIds = new Map<string, string>();

  const parse = <S extends z.ZodType>(path: string, schema: S) => {
    let json: unknown;
    try {
      json = JSON.parse(files[path]);
    } catch (error) {
      issues.push({
        path,
        message: `Invalid JSON: ${error instanceof Error ? error.message : "could not parse"}`,
      });
      return null;
    }
    const result = schema.safeParse(json);
    if (!result.success) {
      issues.push({ path, message: z.prettifyError(result.error) });
      return null;
    }
    return result.data as z.output<S>;
  };

  const claimId = (id: string, path: string) => {
    const owner = usedIds.get(id);
    if (owner) {
      issues.push({
        path,
        message: `Duplicate id "${id}", already used by ${owner}.`,
      });
      return false;
    }
    usedIds.set(id, path);
    paths[id] = path;
    return true;
  };

  let manifest: WorkspaceManifest = createManifest("", "");
  if (!(MANIFEST_PATH in files)) {
    issues.push({
      path: MANIFEST_PATH,
      message:
        "Missing aurolis.json: this folder isn't an Aurolis workspace yet.",
    });
  } else {
    const parsed = parse(MANIFEST_PATH, manifestFileSchema);
    if (parsed) {
      manifest = parsed;
      if (parsed.format > WORKSPACE_FORMAT_VERSION) {
        issues.push({
          path: MANIFEST_PATH,
          message: `Created by a newer version of Aurolis (format ${parsed.format}). Update Aurolis to edit it safely.`,
        });
      }
    }
  }

  const nodes = new Map<string, DirNode>();
  const collections: Collection[] = [];

  const ensureNode = (dir: string, metaIsInvalid = false): DirNode => {
    const existing = nodes.get(dir);
    if (existing) return existing;
    const parentDir = dirOf(dir);
    const isCollection = parentDir === COLLECTIONS_DIR;
    const metaPath = join(dir, isCollection ? COLLECTION_FILE : FOLDER_FILE);
    const id = generatedId(dir);
    if (!metaIsInvalid) {
      issues.push({
        path: metaPath,
        message: `Missing ${isCollection ? COLLECTION_FILE : FOLDER_FILE}; using the folder name.`,
      });
    }
    claimId(id, metaPath);
    return createNode(dir, isCollection, { id, name: baseOf(dir), seq: 0 });
  };

  const createNode = (
    dir: string,
    isCollection: boolean,
    meta: { id: string; name: string; seq: number } & Partial<
      Omit<Collection, "items">
    >,
  ): DirNode => {
    if (isCollection) {
      const collection: Collection = {
        description: "",
        auth: { type: "none" },
        variables: [],
        ...meta,
        items: [],
      };
      collections.push(collection);
      const node: DirNode = { dir, kind: "collection", collection };
      nodes.set(dir, node);
      return node;
    }
    const folder: Folder = {
      type: "folder",
      id: meta.id,
      name: meta.name,
      seq: meta.seq,
      description: meta.description ?? "",
      auth: meta.auth ?? { type: "inherit" },
      items: [],
    };
    const parent = ensureNode(dirOf(dir));
    itemsOf(parent).push(folder);
    const node: DirNode = { dir, kind: "folder", folder };
    nodes.set(dir, node);
    return node;
  };

  const itemsOf = (node: DirNode) =>
    node.kind === "collection"
      ? (node.collection as Collection).items
      : (node.folder as Folder).items;

  const allPaths = Object.keys(files).sort();
  const collectionPaths = allPaths.filter((p) =>
    p.startsWith(`${COLLECTIONS_DIR}/`),
  );

  const metaPaths = collectionPaths
    .filter(
      (p) => p.endsWith(`/${COLLECTION_FILE}`) || p.endsWith(`/${FOLDER_FILE}`),
    )
    .sort(
      (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b),
    );

  for (const path of metaPaths) {
    const dir = dirOf(path);
    const depth = dir.split("/").length;
    const isCollectionMeta = path.endsWith(`/${COLLECTION_FILE}`);
    if (isCollectionMeta !== (depth === 2)) {
      issues.push({
        path,
        message: isCollectionMeta
          ? `${COLLECTION_FILE} belongs directly inside ${COLLECTIONS_DIR}/<collection>/; ignored.`
          : `${FOLDER_FILE} can't be at the top of ${COLLECTIONS_DIR}/; ignored.`,
      });
      continue;
    }
    if (dir.endsWith(EXAMPLES_DIR_SUFFIX)) {
      issues.push({
        path,
        message: "Folders can't live inside an examples folder; ignored.",
      });
      continue;
    }
    const meta = parse(
      path,
      isCollectionMeta ? collectionFileSchema : folderFileSchema,
    );
    if (!meta) {
      ensureNode(dir, true);
      continue;
    }
    const id = claimId(meta.id, path) ? meta.id : generatedId(dir);
    if (id !== meta.id) claimId(id, path);
    createNode(dir, isCollectionMeta, { ...meta, id });
  }

  const requestsByPath = new Map<string, ApiRequest>();
  for (const path of collectionPaths) {
    if (!path.endsWith(REQUEST_EXT)) continue;
    const dir = dirOf(path);
    if (dir === COLLECTIONS_DIR) {
      issues.push({
        path,
        message: "Requests must be inside a collection folder; ignored.",
      });
      continue;
    }
    if (dir.endsWith(EXAMPLES_DIR_SUFFIX)) {
      issues.push({
        path,
        message: "Requests can't live inside an examples folder; ignored.",
      });
      continue;
    }
    const meta = parse(path, requestFileSchema);
    if (!meta || !claimId(meta.id, path)) continue;
    const request: ApiRequest = { type: "request", ...meta, examples: [] };
    itemsOf(ensureNode(dir)).push(request);
    requestsByPath.set(path, request);
  }

  for (const path of collectionPaths) {
    if (
      path.endsWith(REQUEST_EXT) ||
      path.endsWith(`/${COLLECTION_FILE}`) ||
      path.endsWith(`/${FOLDER_FILE}`)
    ) {
      continue;
    }
    const dir = dirOf(path);
    if (dir.endsWith(EXAMPLES_DIR_SUFFIX) && path.endsWith(JSON_EXT)) {
      const requestPath = `${dir.slice(0, -EXAMPLES_DIR_SUFFIX.length)}${REQUEST_EXT}`;
      const request = requestsByPath.get(requestPath);
      if (!request) {
        issues.push({
          path,
          message: `No request at ${requestPath} for this example; ignored.`,
        });
        continue;
      }
      const example = parse(path, exampleFileSchema);
      if (!example || !claimId(example.id, path)) continue;
      request.examples.push(example as RequestExample);
      continue;
    }
    issues.push({ path, message: "Not an Aurolis workspace file; ignored." });
  }

  const sortItems = (items: CollectionItem[]) => {
    items.sort(bySeq);
    for (const item of items) {
      if (item.type === "folder") sortItems(item.items);
      else item.examples.sort(bySeq);
    }
  };
  collections.sort(bySeq);
  for (const collection of collections) sortItems(collection.items);

  const environments: Environment[] = [];
  let globals: Environment | null = null;
  for (const path of allPaths) {
    if (!path.startsWith(`${ENVIRONMENTS_DIR}/`)) continue;
    const name = path.slice(ENVIRONMENTS_DIR.length + 1);
    if (name.includes("/") || !name.endsWith(ENVIRONMENT_EXT)) {
      issues.push({
        path,
        message: "Not an Aurolis environment file; ignored.",
      });
      continue;
    }
    const environment = parse(path, environmentFileSchema);
    if (!environment || !claimId(environment.id, path)) continue;
    if (name === GLOBALS_FILE) globals = environment;
    else environments.push(environment);
  }
  environments.sort(bySeq);

  return {
    workspace: { manifest, collections, environments, globals },
    paths,
    issues,
  };
}
