import { app, BrowserWindow, dialog, shell } from "electron";
import { randomUUID } from "node:crypto";
import { existsSync, watch, type FSWatcher } from "node:fs";
import {
  access,
  constants,
  lstat,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  statfs,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createManifest,
  fromFiles,
  MANIFEST_PATH,
  slugify,
  stableStringify,
} from "../src/lib/workspace-format.ts";
import {
  workspaceNameSchema,
  workspaceRegistrySchema,
  type WorkspaceRegistry,
} from "../src/validators/workspace-store.schema.ts";
import type {
  CloneResult,
  OpenedWorkspace,
  PublishResult,
  RemoveCheck,
  StorageFolderCheck,
  StorageWarning,
  WorkspaceEntry,
  WorkspaceErrorCode,
  WorkspaceErrorInfo,
  WorkspaceRegistryView,
  WorkspaceResult,
} from "../src/types/workspace/workspace-store.type.ts";
import {
  addRemote,
  changedFileCount,
  cloneRepository,
  commitAll,
  configureManagedRepository,
  currentBranch,
  GitCommandError,
  hasCommits,
  initRepository,
  isRepository,
  normalizeCloneUrl,
  parseGithubRemote,
  pushNewBranch,
  remoteUrl,
  removeRemote,
  repoNameFromUrl,
  sameRemote,
  unpushedCommitCount,
} from "./git.ts";
import { isGithubOwner, isGithubRepoName } from "./github-sync.ts";

const WORKSPACE_DIRS = ["collections", "environments"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_SCAN_DEPTH = 3;
const CHANGE_DEBOUNCE_MS = 400;
const SKIPPED_DIRS = new Set([".git", "node_modules"]);
const CLOUD_FOLDER_PATTERNS = [
  /[\\/]library[\\/]mobile documents([\\/]|$)/i,
  /[\\/]library[\\/]cloudstorage([\\/]|$)/i,
  /[\\/]icloud ?drive([\\/]|$)/i,
  /[\\/]onedrive[^\\/]*([\\/]|$)/i,
  /[\\/]dropbox([\\/]|$)/i,
  /[\\/]google ?drive([\\/]|$)/i,
];

export class WorkspaceError extends Error {
  readonly code: WorkspaceErrorCode;

  constructor(code: WorkspaceErrorCode, message?: string) {
    super(message ?? code);
    this.name = "WorkspaceError";
    this.code = code;
  }
}

const userData = () => app.getPath("userData");
const registryFile = () => path.join(userData(), "workspaces.json");
const stateDir = (id: string) => path.join(userData(), "workspaces", id);
const defaultStorageFolder = () => path.join(app.getPath("home"), "Aurolis");
const toPosix = (value: string) => value.split(path.sep).join("/");

const isInside = (child: string, parent: string) => {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

export function displayPath(target: string) {
  if (process.platform === "win32") return target;
  const home = app.getPath("home");
  return isInside(target, home)
    ? `~${target.slice(home.length) || ""}`
    : target;
}

async function writeAtomic(file: string, content: string) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, content, "utf8");
  await rename(temp, file);
}

let registry: WorkspaceRegistry | null = null;
let registryWrite: Promise<void> = Promise.resolve();

const emptyRegistry = (): WorkspaceRegistry => ({
  version: 1,
  storageFolder: null,
  activeWorkspaceId: null,
  workspaces: [],
});

async function setAsideUnreadableRegistry() {
  try {
    await rename(registryFile(), `${registryFile()}.unreadable-${Date.now()}`);
  } catch {
    return;
  }
}

async function loadRegistry(): Promise<WorkspaceRegistry> {
  if (registry) return registry;
  try {
    const raw = await readFile(registryFile(), "utf8");
    const parsed = workspaceRegistrySchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      registry = parsed.data;
      return registry;
    }
    await setAsideUnreadableRegistry();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      await setAsideUnreadableRegistry();
    }
  }
  registry = emptyRegistry();
  return registry;
}

function saveRegistry() {
  const snapshot = stableStringify(registry ?? emptyRegistry());
  registryWrite = registryWrite
    .catch(() => undefined)
    .then(() => writeAtomic(registryFile(), snapshot));
  return registryWrite;
}

async function nearestExisting(target: string) {
  let current = target;
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return current;
}

async function insideGitRepository(target: string) {
  const existing = await nearestExisting(target);
  let current = existing ?? target;
  while (true) {
    if (existsSync(path.join(current, ".git"))) return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

export async function checkStorageFolder(
  candidate: string,
): Promise<StorageFolderCheck> {
  const target = path.resolve(candidate);
  const check: StorageFolderCheck = {
    path: target,
    displayPath: displayPath(target),
    writable: false,
    freeBytes: null,
    warnings: [],
    error: null,
  };
  if (isInside(target, userData()) || isInside(userData(), target)) {
    check.error = "Choose a folder outside Aurolis's own app data.";
    return check;
  }
  const existing = await nearestExisting(target);
  if (!existing) {
    check.error = "This drive or folder isn't available.";
    return check;
  }
  try {
    await access(existing, constants.W_OK);
    check.writable = true;
  } catch {
    check.error = "Aurolis can't write to this folder.";
  }
  try {
    const stats = await statfs(existing);
    check.freeBytes = Number(stats.bavail) * Number(stats.bsize);
  } catch {
    check.freeBytes = null;
  }
  const warnings: StorageWarning[] = [];
  if (CLOUD_FOLDER_PATTERNS.some((pattern) => pattern.test(target))) {
    warnings.push("cloud_synced");
  }
  if (process.platform === "win32" && /^\\\\/.test(target)) {
    warnings.push("network_drive");
  }
  const nested = await insideGitRepository(target);
  if (nested) warnings.push("inside_git_repo");
  check.warnings = warnings;
  return check;
}

async function registryView(): Promise<WorkspaceRegistryView> {
  const current = await loadRegistry();
  return {
    storageFolder: current.storageFolder,
    storageFolderDisplay: current.storageFolder
      ? displayPath(current.storageFolder)
      : null,
    defaultStorageFolder: await checkStorageFolder(defaultStorageFolder()),
    activeWorkspaceId: current.activeWorkspaceId,
    workspaces: [...current.workspaces]
      .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
      .map((entry) => ({ ...entry, missing: !existsSync(entry.repoDir) })),
  };
}

export const listWorkspaces = registryView;

let chosenStorageFolder: string | null = null;

export async function chooseStorageFolder(
  window: BrowserWindow | null,
): Promise<StorageFolderCheck | null> {
  const current = await loadRegistry();
  const options: Electron.OpenDialogOptions = {
    title: "Choose where Aurolis stores workspaces",
    defaultPath: current.storageFolder ?? app.getPath("home"),
    properties: ["openDirectory", "createDirectory", "promptToCreate"],
  };
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return null;
  chosenStorageFolder = path.resolve(result.filePaths[0]);
  return checkStorageFolder(chosenStorageFolder);
}

export async function setStorageFolder(
  choice: unknown,
): Promise<WorkspaceRegistryView> {
  const target =
    choice === "default"
      ? defaultStorageFolder()
      : choice === "chosen"
        ? chosenStorageFolder
        : null;
  if (!target)
    throw new WorkspaceError("invalid_input", "Choose a folder first.");
  const check = await checkStorageFolder(target);
  if (check.error || !check.writable) {
    throw new WorkspaceError("storage_invalid", check.error ?? undefined);
  }
  await mkdir(target, { recursive: true });
  const current = await loadRegistry();
  current.storageFolder = target;
  await saveRegistry();
  return registryView();
}

async function requireStorageFolder() {
  const current = await loadRegistry();
  if (!current.storageFolder) throw new WorkspaceError("storage_not_set");
  await mkdir(current.storageFolder, { recursive: true });
  return current.storageFolder;
}

function uniqueFolder(parent: string, name: string) {
  const base = slugify(name, "workspace");
  let candidate = base;
  for (let n = 2; existsSync(path.join(parent, candidate)); n++) {
    candidate = `${base}-${n}`;
  }
  return path.join(parent, candidate);
}

function validName(name: unknown) {
  const parsed = workspaceNameSchema.safeParse(name);
  if (!parsed.success) {
    throw new WorkspaceError("invalid_input", parsed.error.issues[0]?.message);
  }
  return parsed.data;
}

async function findEntry(id: unknown) {
  const current = await loadRegistry();
  const entry = current.workspaces.find((w) => w.id === id);
  if (!entry) throw new WorkspaceError("not_found");
  return entry;
}

async function workspaceRootFor(repoDir: string, picked: string) {
  const pickedRoot = toPosix(path.relative(repoDir, picked));
  if (pickedRoot) return pickedRoot;
  return findWorkspaceRoot(repoDir);
}

async function findWorkspaceRoot(repoDir: string) {
  if (existsSync(path.join(repoDir, MANIFEST_PATH))) return "";
  const queue: { dir: string; depth: number }[] = [{ dir: repoDir, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift() as { dir: string; depth: number };
    if (depth >= MAX_SCAN_DEPTH) continue;
    let children: string[];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      children = entries
        .filter((child) => child.isDirectory() && !SKIPPED_DIRS.has(child.name))
        .map((child) => path.join(dir, child.name))
        .sort();
    } catch {
      continue;
    }
    for (const child of children) {
      if (existsSync(path.join(child, MANIFEST_PATH))) {
        return toPosix(path.relative(repoDir, child));
      }
      queue.push({ dir: child, depth: depth + 1 });
    }
  }
  return "";
}

async function addEntry(entry: WorkspaceEntry) {
  const current = await loadRegistry();
  current.workspaces.push(entry);
  current.activeWorkspaceId = entry.id;
  await mkdir(stateDir(entry.id), { recursive: true });
  await saveRegistry();
}

const now = () => new Date().toISOString();

export async function createLocalWorkspace(
  params: unknown,
): Promise<{ workspaceId: string }> {
  const name = validName((params as { name?: unknown })?.name);
  const storage = await requireStorageFolder();
  const repoDir = uniqueFolder(storage, name);
  await mkdir(repoDir, { recursive: true });
  try {
    await initRepository(repoDir);
    await configureManagedRepository(repoDir);
    await writeAtomic(
      path.join(repoDir, MANIFEST_PATH),
      stableStringify(createManifest(randomUUID(), name)),
    );
    await commitAll(repoDir, "Create workspace");
  } catch (error) {
    await rm(repoDir, { recursive: true, force: true });
    throw error;
  }
  const id = randomUUID();
  await addEntry({
    id,
    name,
    repoDir,
    root: "",
    managed: true,
    remote: null,
    createdAt: now(),
    lastOpenedAt: now(),
  });
  return { workspaceId: id };
}

const cloneControllers = new Set<AbortController>();

export function cancelClones() {
  for (const controller of cloneControllers) controller.abort();
  cloneControllers.clear();
}

export async function cloneWorkspace(params: unknown): Promise<CloneResult> {
  const input = (params as { url?: unknown })?.url;
  const url = typeof input === "string" ? normalizeCloneUrl(input) : null;
  if (!url) {
    throw new WorkspaceError(
      "invalid_url",
      "Paste an https:// or SSH git URL, or a GitHub owner/repo.",
    );
  }
  const current = await loadRegistry();
  const existing = current.workspaces.find(
    (w) => w.remote && w.root === "" && sameRemote(w.remote.url, url),
  );
  if (existing) {
    current.activeWorkspaceId = existing.id;
    await saveRegistry();
    return { workspaceId: existing.id, alreadyAdded: true };
  }

  const storage = await requireStorageFolder();
  const repoName = repoNameFromUrl(url);
  const repoDir = uniqueFolder(storage, repoName);
  const controller = new AbortController();
  cloneControllers.add(controller);
  try {
    await cloneRepository(url, repoDir, controller.signal);
    await configureManagedRepository(repoDir);
  } catch (error) {
    await rm(repoDir, { recursive: true, force: true });
    throw error;
  } finally {
    cloneControllers.delete(controller);
  }

  const id = randomUUID();
  const root = await findWorkspaceRoot(repoDir);
  await addEntry({
    id,
    name: repoName,
    repoDir,
    root,
    managed: true,
    remote: { url, github: parseGithubRemote(url) },
    createdAt: now(),
    lastOpenedAt: now(),
  });
  return { workspaceId: id, alreadyAdded: false };
}

export async function openExistingFolder(
  window: BrowserWindow | null,
): Promise<CloneResult> {
  const options: Electron.OpenDialogOptions = {
    title: "Open a git repository",
    defaultPath: app.getPath("home"),
    properties: ["openDirectory"],
  };
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) {
    throw new WorkspaceError("cancelled");
  }
  const picked = path.resolve(result.filePaths[0]);
  const repoDir = await isRepository(picked);
  if (!repoDir) {
    throw new WorkspaceError(
      "not_a_repository",
      "That folder isn't a git repository. Pick the folder you cloned.",
    );
  }
  const root = await workspaceRootFor(repoDir, picked);

  const current = await loadRegistry();
  const existing = current.workspaces.find(
    (w) => path.resolve(w.repoDir) === repoDir && w.root === root,
  );
  if (existing) {
    current.activeWorkspaceId = existing.id;
    await saveRegistry();
    return { workspaceId: existing.id, alreadyAdded: true };
  }

  const url = await remoteUrl(repoDir);
  const id = randomUUID();
  await addEntry({
    id,
    name: path.basename(root ? path.join(repoDir, root) : repoDir),
    repoDir,
    root,
    managed: false,
    remote: url ? { url, github: parseGithubRemote(url) } : null,
    createdAt: now(),
    lastOpenedAt: now(),
  });
  return { workspaceId: id, alreadyAdded: false };
}

async function readWorkspaceFiles(rootDir: string) {
  const files: Record<string, string> = {};
  const oversized: string[] = [];

  const readOne = async (absolute: string) => {
    const info = await lstat(absolute);
    if (!info.isFile()) return;
    const relative = toPosix(path.relative(rootDir, absolute));
    if (info.size > MAX_FILE_BYTES) {
      oversized.push(relative);
      return;
    }
    files[relative] = await readFile(absolute, "utf8");
  };

  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) await readOne(absolute);
    }
  };

  const manifest = path.join(rootDir, MANIFEST_PATH);
  if (existsSync(manifest)) await readOne(manifest);
  for (const dir of WORKSPACE_DIRS) await walk(path.join(rootDir, dir));
  return { files, oversized };
}

let watchers: FSWatcher[] = [];
let watchedId: string | null = null;
let changeTimer: ReturnType<typeof setTimeout> | null = null;

function stopWatching() {
  for (const watcher of watchers) watcher.close();
  watchers = [];
  watchedId = null;
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = null;
}

function notifyChanged(id: string) {
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = setTimeout(() => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("aurolis:workspace:changed", id);
    }
  }, CHANGE_DEBOUNCE_MS);
}

function watchWorkspace(entry: WorkspaceEntry) {
  if (watchedId === entry.id) return;
  stopWatching();
  watchedId = entry.id;
  const rootDir = path.join(entry.repoDir, entry.root);
  const onEvent = () => notifyChanged(entry.id);
  const add = (target: string, recursive: boolean) => {
    if (!existsSync(target)) return;
    try {
      const watcher = watch(target, { recursive }, onEvent);
      watcher.on("error", () => undefined);
      watchers.push(watcher);
    } catch {
      return;
    }
  };
  add(rootDir, false);
  for (const dir of WORKSPACE_DIRS) add(path.join(rootDir, dir), true);
  const gitDir = path.join(entry.repoDir, ".git");
  add(gitDir, false);
  add(path.join(gitDir, "refs"), true);
}

export async function openWorkspace(id: unknown): Promise<OpenedWorkspace> {
  const entry = await findEntry(id);
  if (!existsSync(entry.repoDir)) {
    throw new WorkspaceError(
      "missing_folder",
      `The folder ${displayPath(entry.repoDir)} was moved or deleted.`,
    );
  }
  const rootDir = path.join(entry.repoDir, entry.root);
  const { files, oversized } = await readWorkspaceFiles(rootDir);
  const isWorkspace = MANIFEST_PATH in files;
  const parsed = fromFiles(files);
  const issues = [
    ...(isWorkspace ? parsed.issues : []),
    ...oversized.map((file) => ({
      path: file,
      message: "Larger than 5 MB; not loaded.",
    })),
  ];

  const [branch, changedFiles, url] = await Promise.all([
    currentBranch(entry.repoDir),
    changedFileCount(entry.repoDir, entry.root),
    remoteUrl(entry.repoDir),
  ]);
  const unpushedCommits = url ? await unpushedCommitCount(entry.repoDir) : 0;
  entry.remote = url ? { url, github: parseGithubRemote(url) } : null;
  entry.lastOpenedAt = now();
  const current = await loadRegistry();
  current.activeWorkspaceId = entry.id;
  await saveRegistry();
  watchWorkspace(entry);

  return {
    entry,
    displayPath: displayPath(rootDir),
    isWorkspace,
    data: isWorkspace ? parsed.workspace : null,
    issues,
    git: { branch, changedFiles, unpushedCommits, remoteUrl: url },
  };
}

export async function initializeWorkspace(id: unknown) {
  const entry = await findEntry(id);
  const manifest = path.join(entry.repoDir, entry.root, MANIFEST_PATH);
  if (!existsSync(manifest)) {
    await writeAtomic(
      manifest,
      stableStringify(createManifest(randomUUID(), entry.name)),
    );
  }
  return openWorkspace(entry.id);
}

export async function renameWorkspace(params: unknown) {
  const { id, name } = (params ?? {}) as { id?: unknown; name?: unknown };
  const entry = await findEntry(id);
  entry.name = validName(name);
  await saveRegistry();
  return registryView();
}

async function commitIfRequested(
  dir: string,
  root: string,
  requested: boolean,
) {
  if (!requested) return false;
  const changed = await changedFileCount(dir, root);
  if (changed === 0) return false;
  const hasHistory = await hasCommits(dir);
  const message = hasHistory ? "Update workspace" : "Create workspace";
  await commitAll(dir, message, root);
  return true;
}

export async function publishWorkspace(
  params: unknown,
): Promise<PublishResult> {
  const { id, owner, repo, commitChanges } = (params ?? {}) as {
    id?: unknown;
    owner?: unknown;
    repo?: unknown;
    commitChanges?: unknown;
  };
  if (!isGithubOwner(owner) || !isGithubRepoName(repo)) {
    throw new WorkspaceError("invalid_input", "Invalid repository name.");
  }
  const entry = await findEntry(id);
  const dir = entry.repoDir;
  if (!existsSync(dir)) {
    throw new WorkspaceError(
      "missing_folder",
      `The folder ${displayPath(dir)} was moved or deleted.`,
    );
  }

  const url = `https://github.com/${owner}/${repo}.git`;
  const existing = await remoteUrl(dir);
  if (existing && !sameRemote(existing, url)) {
    throw new WorkspaceError("remote_exists");
  }
  const branch = await currentBranch(dir);
  if (!branch) throw new WorkspaceError("detached_head");

  const committed = await commitIfRequested(
    dir,
    entry.root,
    commitChanges === true,
  );
  const hasHistory = await hasCommits(dir);
  if (!hasHistory) throw new WorkspaceError("nothing_to_publish");

  if (!existing) await addRemote(dir, url);
  try {
    await pushNewBranch(dir, branch);
  } catch (error) {
    if (!existing) await removeRemote(dir);
    throw error;
  }

  entry.remote = { url, github: { owner, repo } };
  await saveRegistry();
  return { webUrl: `https://github.com/${owner}/${repo}`, branch, committed };
}

export async function revealWorkspace(id: unknown) {
  const entry = await findEntry(id);
  if (!existsSync(entry.repoDir)) throw new WorkspaceError("missing_folder");
  const error = await shell.openPath(path.join(entry.repoDir, entry.root));
  if (error) throw new WorkspaceError("unknown", error);
}

export async function removeCheck(id: unknown): Promise<RemoveCheck> {
  const entry = await findEntry(id);
  if (!existsSync(entry.repoDir)) {
    return {
      managed: entry.managed,
      changedFiles: 0,
      unpushedCommits: 0,
      hasRemote: Boolean(entry.remote),
    };
  }
  const [changedFiles, unpushedCommits, url] = await Promise.all([
    changedFileCount(entry.repoDir, ""),
    unpushedCommitCount(entry.repoDir),
    remoteUrl(entry.repoDir),
  ]);
  return {
    managed: entry.managed,
    changedFiles,
    unpushedCommits,
    hasRemote: Boolean(url),
  };
}

export async function removeWorkspace(params: unknown) {
  const { id, deleteFolder } = (params ?? {}) as {
    id?: unknown;
    deleteFolder?: unknown;
  };
  const entry = await findEntry(id);
  const current = await loadRegistry();
  if (watchedId === entry.id) stopWatching();
  current.workspaces = current.workspaces.filter((w) => w.id !== entry.id);
  if (current.activeWorkspaceId === entry.id) {
    current.activeWorkspaceId =
      [...current.workspaces].sort((a, b) =>
        b.lastOpenedAt.localeCompare(a.lastOpenedAt),
      )[0]?.id ?? null;
  }
  await saveRegistry();
  await rm(stateDir(entry.id), { recursive: true, force: true });

  const canDelete =
    deleteFolder === true &&
    entry.managed &&
    existsSync(path.join(entry.repoDir, ".git")) &&
    path.resolve(entry.repoDir) !== path.resolve(os.homedir()) &&
    path.resolve(entry.repoDir) !== path.resolve(current.storageFolder ?? "");
  if (canDelete) await rm(entry.repoDir, { recursive: true, force: true });
  return registryView();
}

export async function toWorkspaceResult<T>(
  operation: () => Promise<T>,
): Promise<WorkspaceResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    let info: WorkspaceErrorInfo;
    if (error instanceof WorkspaceError) {
      info = { code: error.code, message: error.message };
    } else if (error instanceof GitCommandError) {
      info = { code: error.code, message: error.message };
    } else {
      info = {
        code: "unknown",
        message: error instanceof Error ? error.message : undefined,
      };
    }
    if (info.message === info.code) delete info.message;
    return { ok: false, error: info };
  }
}
