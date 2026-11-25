import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type {
  ChangedFile,
  ChangeStatus,
  CommitResult,
  DiffLine,
  SourceControlChanges,
} from "../src/types/workspace/source-control.type.ts";
import type { WorkspaceEntry } from "../src/types/workspace/workspace-store.type.ts";
import { commitParamsSchema } from "../src/validators/source-control.schema.ts";
import {
  commitPaths,
  commitsBehind,
  currentBranch,
  diffAgainstHead,
  fetchOrigin,
  GitCommandError,
  hasCommits,
  hasUpstream,
  mergeRef,
  pushBranch,
  remoteBranchExists,
  remoteUrl,
  statusEntries,
  unpushedCommitCount,
  type StatusEntry,
} from "./git.ts";
import { findEntry, WorkspaceError } from "./workspace-store.ts";

const MAX_FILES = 300;
const MAX_LINES_PER_FILE = 1500;
const MAX_NEW_FILE_BYTES = 512 * 1024;
const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

type ParsedDiff = { lines: DiffLine[]; binary: boolean; truncated: boolean };

function statusOf(code: string): ChangeStatus {
  if (code === "??") return "added";
  if (code.includes("U") || code === "AA" || code === "DD") return "conflicted";
  if (code[0] === "R" || code[0] === "C") return "renamed";
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

function splitFileDiffs(diff: string) {
  const byPath = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of diff.split("\n")) {
    const header = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (header) {
      current = [];
      byPath.set(header[2], current);
      continue;
    }
    current?.push(line);
  }
  return byPath;
}

function lineFor(
  raw: string,
  position: { old: number; new: number },
): DiffLine | null {
  const marker = raw[0];
  const text = raw.slice(1);
  if (marker === "+") {
    return { kind: "add", text, oldLine: null, newLine: position.new++ };
  }
  if (marker === "-") {
    return { kind: "delete", text, oldLine: position.old++, newLine: null };
  }
  if (marker === " ") {
    return {
      kind: "context",
      text,
      oldLine: position.old++,
      newLine: position.new++,
    };
  }
  return null;
}

function parseFileDiff(rawLines: string[]): ParsedDiff {
  const lines: DiffLine[] = [];
  const position = { old: 0, new: 0 };
  let inHunk = false;
  for (const raw of rawLines) {
    if (raw.startsWith("Binary files"))
      return { lines: [], binary: true, truncated: false };
    const hunk = raw.match(HUNK_HEADER);
    if (hunk) {
      inHunk = true;
      position.old = Number(hunk[1]);
      position.new = Number(hunk[2]);
      lines.push({ kind: "hunk", text: raw, oldLine: null, newLine: null });
      continue;
    }
    if (!inHunk) continue;
    const line = lineFor(raw, position);
    if (line) lines.push(line);
    if (lines.length >= MAX_LINES_PER_FILE) {
      return { lines, binary: false, truncated: true };
    }
  }
  return { lines, binary: false, truncated: false };
}

async function newFileDiff(absolute: string): Promise<ParsedDiff> {
  let content: Buffer;
  try {
    content = await readFile(absolute);
  } catch {
    return { lines: [], binary: false, truncated: false };
  }
  if (content.includes(0)) return { lines: [], binary: true, truncated: false };
  const truncatedBytes = content.byteLength > MAX_NEW_FILE_BYTES;
  const text = content.subarray(0, MAX_NEW_FILE_BYTES).toString("utf8");
  const rows = text.replace(/\n$/, "").split("\n");
  const kept = rows.slice(0, MAX_LINES_PER_FILE);
  const lines: DiffLine[] = [
    {
      kind: "hunk",
      text: `@@ -0,0 +1,${rows.length} @@`,
      oldLine: null,
      newLine: null,
    },
    ...kept.map((row, index) => ({
      kind: "add" as const,
      text: row,
      oldLine: null,
      newLine: index + 1,
    })),
  ];
  const truncated = truncatedBytes || rows.length > kept.length;
  return { lines, binary: false, truncated };
}

function countLines(lines: DiffLine[]) {
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.kind === "add") additions += 1;
    if (line.kind === "delete") deletions += 1;
  }
  return { additions, deletions };
}

function needsFileContent(entry: StatusEntry, headExists: boolean) {
  return entry.code === "??" || !headExists;
}

async function describeEntry(
  dir: string,
  root: string,
  entry: StatusEntry,
  diffs: Map<string, string[]>,
  headExists: boolean,
): Promise<ChangedFile> {
  const status = statusOf(entry.code);
  const parsed =
    needsFileContent(entry, headExists) && status !== "deleted"
      ? await newFileDiff(path.join(dir, ...entry.path.split("/")))
      : parseFileDiff(diffs.get(entry.path) ?? []);
  return {
    path: relativeToRoot(entry.path, root),
    oldPath: entry.oldPath ? relativeToRoot(entry.oldPath, root) : null,
    status,
    ...countLines(parsed.lines),
    ...parsed,
  };
}

export async function listChanges(
  workspaceId: unknown,
): Promise<SourceControlChanges> {
  const entry = await findEntry(workspaceId);
  const dir = requireFolder(entry);
  const [branch, url, entries, headExists] = await Promise.all([
    currentBranch(dir),
    remoteUrl(dir),
    statusEntries(dir, entry.root),
    hasCommits(dir),
  ]);
  const listed = entries.slice(0, MAX_FILES);
  const tracked = listed
    .filter((item) => !needsFileContent(item, headExists))
    .flatMap((item) =>
      item.oldPath ? [item.oldPath, item.path] : [item.path],
    );
  const diff = headExists ? await diffAgainstHead(dir, tracked) : "";
  const diffs = splitFileDiffs(diff);
  const files: ChangedFile[] = [];
  for (const item of listed) {
    files.push(await describeEntry(dir, entry.root, item, diffs, headExists));
  }
  const unpushedCommits =
    url && headExists ? await unpushedCommitCount(dir) : 0;
  return {
    branch,
    remoteUrl: url,
    unpushedCommits,
    files,
    truncatedFiles: entries.length - listed.length,
  };
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
  const parsed = commitParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new WorkspaceError("invalid_input", z.prettifyError(parsed.error));
  }
  const { workspaceId, message, sync } = parsed.data;
  const entry = await findEntry(workspaceId);
  const dir = requireFolder(entry);
  const branch = await currentBranch(dir);
  if (!branch) throw new WorkspaceError("detached_head");

  const changes = await statusEntries(dir, entry.root);
  const committed = changes.length > 0;
  if (committed) await commitPaths(dir, message, entry.root);

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
