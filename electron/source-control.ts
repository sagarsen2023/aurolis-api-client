import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  describeChanges,
  type ChangedFileContent,
  type KnownNames,
} from "../src/lib/change-items.ts";
import { fromFiles } from "../src/lib/workspace-format.ts";
import type { CollectionItem } from "../src/types/workspace/collection.type.ts";
import type {
  ChangeStatus,
  CommitResult,
  SourceControlChanges,
} from "../src/types/workspace/source-control.type.ts";
import type { WorkspaceEntry } from "../src/types/workspace/workspace-store.type.ts";
import { commitParamsSchema } from "../src/validators/source-control.schema.ts";
import {
  changedPaths,
  commitPaths,
  commitsBehind,
  currentBranch,
  fetchOrigin,
  GitCommandError,
  hasCommits,
  hasUpstream,
  mergeRef,
  pushBranch,
  remoteBranchExists,
  remoteUrl,
  showHeadFile,
  statusEntries,
  unpushedCommitCount,
  type StatusEntry,
} from "./git.ts";
import { secretValues } from "./secret-store.ts";
import {
  findEntry,
  readWorkspaceFiles,
  parseWorkspaceInput,
  WorkspaceError,
  workspacePathspecs,
} from "./workspace-store.ts";

const MAX_CONTENT_BYTES = 1024 * 1024;

const dirOf = (file: string) =>
  file.slice(0, Math.max(file.lastIndexOf("/"), 0));

function statusOf(code: string): ChangeStatus {
  if (code === "??") return "added";
  if (code.includes("U") || code === "AA" || code === "DD") return "conflicted";
  if (code.includes("D")) return "deleted";
  if (code[0] === "A") return "added";
  return "modified";
}

function requireFolder(entry: WorkspaceEntry) {
  if (!existsSync(entry.repoDir)) throw new WorkspaceError("missing_folder");
  return entry.repoDir;
}

function relativeToRoot(file: string, root: string) {
  return root && file.startsWith(`${root}/`)
    ? file.slice(root.length + 1)
    : file;
}

async function workingContent(dir: string, repoPath: string) {
  try {
    const content = await readFile(
      path.join(dir, ...repoPath.split("/")),
      "utf8",
    );
    return content.length > MAX_CONTENT_BYTES ? null : content;
  } catch {
    return null;
  }
}

function changedFiles(entries: StatusEntry[]) {
  return entries.flatMap((entry) => {
    if (!entry.oldPath) {
      return [{ repoPath: entry.path, status: statusOf(entry.code) }];
    }
    return [
      { repoPath: entry.oldPath, status: "deleted" as const },
      { repoPath: entry.path, status: "added" as const },
    ];
  });
}

async function readChangedFile(
  dir: string,
  root: string,
  file: { repoPath: string; status: ChangeStatus },
): Promise<ChangedFileContent> {
  const content =
    file.status === "deleted"
      ? await showHeadFile(dir, file.repoPath)
      : await workingContent(dir, file.repoPath);
  return {
    path: relativeToRoot(file.repoPath, root),
    status: file.status,
    content,
  };
}

function folderNames(
  items: CollectionItem[],
  paths: Record<string, string>,
  known: KnownNames,
) {
  for (const item of items) {
    const file = paths[item.id];
    if (!file) continue;
    if (item.type === "request") {
      known.requests[file] = item.name;
      continue;
    }
    known.folders[dirOf(file)] = item.name;
    folderNames(item.items, paths, known);
  }
}

async function knownNames(entry: WorkspaceEntry): Promise<KnownNames> {
  const known: KnownNames = { collections: {}, folders: {}, requests: {} };
  const { files } = await readWorkspaceFiles(
    path.join(entry.repoDir, entry.root),
  );
  const { workspace, paths } = fromFiles(files);
  for (const collection of workspace.collections) {
    const file = paths[collection.id];
    if (!file) continue;
    known.collections[dirOf(file)] = {
      id: collection.id,
      name: collection.name,
    };
    folderNames(collection.items, paths, known);
  }
  return known;
}

export async function listChanges(
  workspaceId: unknown,
): Promise<SourceControlChanges> {
  const entry = await findEntry(workspaceId);
  const dir = requireFolder(entry);
  const [branch, url, entries, headExists, known] = await Promise.all([
    currentBranch(dir),
    remoteUrl(dir),
    statusEntries(dir, workspacePathspecs(entry.root)),
    hasCommits(dir),
    knownNames(entry),
  ]);
  const files = await Promise.all(
    changedFiles(entries).map((file) => readChangedFile(dir, entry.root, file)),
  );
  const unpushedCommits =
    url && headExists ? await unpushedCommitCount(dir) : 0;
  return {
    branch,
    remoteUrl: url,
    unpushedCommits,
    fileCount: entries.length,
    groups: describeChanges(files, known),
  };
}

async function findSecretLeaks(
  entry: WorkspaceEntry,
  dir: string,
  changes: StatusEntry[],
) {
  const secrets = await secretValues(entry.id);
  if (secrets.length === 0) return [];
  const leaks: string[] = [];
  for (const change of changes) {
    if (statusOf(change.code) === "deleted") continue;
    const content = await workingContent(dir, change.path);
    if (content && secrets.some((secret) => content.includes(secret))) {
      leaks.push(relativeToRoot(change.path, entry.root));
    }
  }
  return leaks;
}

async function refuseSecretLeaks(
  entry: WorkspaceEntry,
  dir: string,
  changes: StatusEntry[],
) {
  const leaks = await findSecretLeaks(entry, dir, changes);
  if (leaks.length === 0) return;
  throw new WorkspaceError(
    "secret_leak",
    `A secret value appears in ${leaks.join(", ")}. Replace it with its {{variable}} and save, then commit.`,
  );
}

async function bringInRemoteChanges(dir: string, branch: string) {
  await fetchOrigin(dir);
  const tracking = await hasUpstream(dir);
  const remoteRef = `refs/remotes/origin/${branch}`;
  const exists = tracking || (await remoteBranchExists(dir, branch));
  if (!exists) return false;
  const ref = tracking ? "@{upstream}" : remoteRef;
  const behind = await commitsBehind(dir, ref);
  if (behind === 0) return false;
  await mergeRef(dir, ref);
  return true;
}

function syncFailure(error: unknown, committed: boolean) {
  if (!(error instanceof GitCommandError)) return error;
  const keepsCode =
    error.code === "merge_conflict" ||
    error.code === "protected_branch" ||
    error.code === "push_rejected";
  if (keepsCode || !committed)
    return new WorkspaceError(error.code, error.message);
  return new WorkspaceError("sync_failed", error.message.trim());
}

export async function commitAndSync(params: unknown): Promise<CommitResult> {
  const { workspaceId, message, sync } = parseWorkspaceInput(
    commitParamsSchema,
    params,
  );
  const entry = await findEntry(workspaceId);
  const dir = requireFolder(entry);
  const branch = await currentBranch(dir);
  if (!branch) throw new WorkspaceError("detached_head");

  const changes = await statusEntries(dir, workspacePathspecs(entry.root));
  await refuseSecretLeaks(entry, dir, changes);
  const committed = changes.length > 0;
  if (committed) await commitPaths(dir, message, changedPaths(changes));

  const url = await remoteUrl(dir);
  if (!sync || !url) {
    if (!committed) throw new WorkspaceError("nothing_to_commit");
    return { committed, pulled: false, pushed: false, branch };
  }

  try {
    const pulled = await bringInRemoteChanges(dir, branch);
    await pushBranch(dir, branch);
    return { committed, pulled, pushed: true, branch };
  } catch (error) {
    throw syncFailure(error, committed);
  }
}
