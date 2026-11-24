// GitHub operations the renderer can ask for over IPC. Each one validates its
// input (the renderer is treated as untrusted) and uses githubApi, so the
// access token stays in the main process.
//
// Commits use the Git Data API, so many changed files land in ONE commit, and
// the branch is moved with force:false, so a teammate's push is never
// overwritten: if the branch moved, the caller gets "conflict" and must pull,
// merge and retry.

import { shell } from "electron";
import { createHash } from "node:crypto";
import githubApi, { GithubApiError } from "./github-api.ts";
import type {
  CommitFilesParams,
  FileChange,
  GithubRepoRef,
  PullFilesParams,
} from "../src/types/github/github-params.type.ts";
import type {
  CommitFilesResponse,
  GithubInstallation,
  GithubRepository,
  GithubResult,
  PulledFile,
  PullFilesResponse,
} from "../src/types/github/github-response.type.ts";

// Public slug of the GitHub App (github.com/apps/<slug>); used for the install link.
const APP_SLUG = import.meta.env.VITE_PUBLIC_GITHUB_APP_SLUG ?? "";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_CHANGES = 1000;
const BLOB_CONCURRENCY = 6;
const FILE_MODE = "100644";

// ---------------------------------------------------------------------------
// Input validation

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,250}$/;

function invalid(message: string): never {
  throw new GithubApiError({ code: "invalid_input", message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validRepoRef(input: unknown): GithubRepoRef {
  if (!isRecord(input)) invalid("Expected an object");
  const { owner, repo, branch } = input;
  if (typeof owner !== "string" || !OWNER_RE.test(owner)) {
    invalid("Invalid owner");
  }
  if (typeof repo !== "string" || !REPO_RE.test(repo) || /^\.+$/.test(repo)) {
    invalid("Invalid repository name");
  }
  if (
    typeof branch !== "string" ||
    !BRANCH_RE.test(branch) ||
    branch.includes("..") ||
    branch.includes("//") ||
    branch.startsWith("/") ||
    branch.endsWith("/") ||
    branch.endsWith(".lock")
  ) {
    invalid("Invalid branch name");
  }
  return { owner, repo, branch };
}

/** Repo-relative path: no leading slash, no "." or ".." segments, no backslashes. */
function validPath(path: unknown, allowEmpty = false): string {
  if (typeof path !== "string") invalid("Invalid path");
  if (allowEmpty && path === "") return "";
  const segments = path.split("/");
  if (
    path.length > 400 ||
    path.includes("\\") ||
    path.includes("\0") ||
    segments.some((s) => s === "" || s === "." || s === "..")
  ) {
    invalid(`Invalid path: ${path}`);
  }
  return path;
}

function validChanges(input: unknown): FileChange[] {
  if (!Array.isArray(input) || input.length === 0) invalid("No changes");
  if (input.length > MAX_CHANGES) invalid(`More than ${MAX_CHANGES} changes`);
  const seen = new Set<string>();
  return input.map((change) => {
    if (!isRecord(change)) invalid("Invalid change");
    const path = validPath(change.path);
    if (seen.has(path)) invalid(`Duplicate path: ${path}`);
    seen.add(path);
    const { content } = change;
    if (content !== null && typeof content !== "string") {
      invalid(`Invalid content for ${path}`);
    }
    if (
      typeof content === "string" &&
      Buffer.byteLength(content) > MAX_FILE_BYTES
    ) {
      throw new GithubApiError({
        code: "too_large",
        message: `${path} is larger than 5 MB`,
      });
    }
    return { path, content };
  });
}

// ---------------------------------------------------------------------------
// Helpers

const repoBase = ({ owner, repo }: GithubRepoRef) =>
  `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

// Branch names may contain "/", which must stay a path separator.
const encodeBranch = (branch: string) =>
  branch.split("/").map(encodeURIComponent).join("/");

/** Git's blob SHA-1 for UTF-8 content, so callers can track files without a refetch. */
function blobSha(content: string) {
  const bytes = Buffer.from(content, "utf8");
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

/** Branch head SHA, or null when the repository has no commits yet. */
async function getHeadSha(ref: GithubRepoRef): Promise<string | null> {
  try {
    const data = await githubApi.get<{ object: { sha: string } }>({
      endpoint: `${repoBase(ref)}/git/ref/heads/${encodeBranch(ref.branch)}`,
    });
    return data.object.sha;
  } catch (error) {
    if (!(error instanceof GithubApiError)) throw error;
    if (error.code === "empty_repository") return null;
    if (error.code === "not_found") throw await explainNotFound(ref);
    throw error;
  }
}

/**
 * GitHub answers 404 both for a missing branch and for a repo the app can't
 * see (not installed there, or no access). Tell the two apart.
 */
async function explainNotFound(ref: GithubRepoRef) {
  try {
    await githubApi.get({ endpoint: repoBase(ref) });
  } catch (error) {
    if (error instanceof GithubApiError && error.code === "not_found") {
      return new GithubApiError({
        code: "not_installed",
        status: 404,
        message: `Aurolis can't see ${ref.owner}/${ref.repo}. Install the GitHub App on it, or check that you have access.`,
      });
    }
    return error;
  }
  return new GithubApiError({
    code: "not_found",
    status: 404,
    message: `Branch "${ref.branch}" doesn't exist in ${ref.owner}/${ref.repo}.`,
  });
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (_item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (index < items.length) {
        const i = index++;
        results[i] = await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Installations and repositories

type ApiInstallation = {
  id: number;
  repository_selection: string;
  account: { login: string; type: string; avatar_url: string } | null;
};

/** Accounts where the user installed the Aurolis GitHub App. Empty = not installed yet. */
export async function listInstallations(): Promise<GithubInstallation[]> {
  const installations = await githubApi.getAll<
    { installations: ApiInstallation[] },
    ApiInstallation
  >({
    endpoint: "/user/installations?per_page=100",
    pick: (page) => page.installations,
  });
  return installations.map((i) => ({
    id: i.id,
    account: i.account?.login ?? "",
    accountType: i.account?.type ?? "",
    avatarUrl: i.account?.avatar_url ?? "",
    repositorySelection: i.repository_selection,
  }));
}

/** Opens GitHub's page for installing the app on an account or more repositories. */
export async function openInstallPage(): Promise<void> {
  await shell.openExternal(
    APP_SLUG
      ? `https://github.com/apps/${encodeURIComponent(APP_SLUG)}/installations/new`
      : "https://github.com/settings/installations",
  );
}

type ApiRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  owner: { login: string };
  permissions?: Partial<Record<keyof GithubRepository["permissions"], boolean>>;
};

/** Repositories the user can reach through the app, with their role on each. */
export async function listRepositories(): Promise<GithubRepository[]> {
  const installations = await listInstallations();
  const byId = new Map<number, GithubRepository>();
  for (const installation of installations) {
    const repos = await githubApi.getAll<
      { repositories: ApiRepository[] },
      ApiRepository
    >({
      endpoint: `/user/installations/${installation.id}/repositories?per_page=100`,
      pick: (page) => page.repositories,
    });
    for (const r of repos) {
      byId.set(r.id, {
        id: r.id,
        owner: r.owner.login,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
        permissions: {
          admin: !!r.permissions?.admin,
          maintain: !!r.permissions?.maintain,
          push: !!r.permissions?.push,
          triage: !!r.permissions?.triage,
          pull: !!r.permissions?.pull,
        },
      });
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );
}

// ---------------------------------------------------------------------------
// Pull

type ApiTree = {
  truncated: boolean;
  tree: { path: string; type: string; sha: string; size?: number }[];
};

/**
 * Reads the branch and downloads only the files that differ from `knownFiles`.
 * Unchanged files cost nothing: their SHAs come from a single tree listing.
 */
export async function pullFiles(input: unknown): Promise<PullFilesResponse> {
  const ref = validRepoRef(input);
  const params = input as PullFilesParams;
  const prefix = validPath(params.path ?? "", true);
  const known: Record<string, string> = isRecord(params.knownFiles)
    ? Object.fromEntries(
        Object.entries(params.knownFiles).filter(
          (e): e is [string, string] => typeof e[1] === "string",
        ),
      )
    : {};
  const inScope = (path: string) =>
    prefix === "" || path === prefix || path.startsWith(`${prefix}/`);

  const headSha = await getHeadSha(ref);
  if (!headSha) {
    return {
      headSha: null,
      changed: [],
      deleted: Object.keys(known).filter(inScope),
      files: {},
    };
  }

  const commit = await githubApi.get<{ tree: { sha: string } }>({
    endpoint: `${repoBase(ref)}/git/commits/${headSha}`,
  });
  const tree = await githubApi.get<ApiTree>({
    endpoint: `${repoBase(ref)}/git/trees/${commit.tree.sha}?recursive=1`,
  });
  if (tree.truncated) {
    throw new GithubApiError({
      code: "too_large",
      message: "The repository has too many files to read in one listing.",
    });
  }

  const blobs = tree.tree.filter((e) => e.type === "blob" && inScope(e.path));
  const files = Object.fromEntries(blobs.map((b) => [b.path, b.sha]));
  const toFetch = blobs.filter((b) => known[b.path] !== b.sha);

  const oversized = toFetch.find((b) => (b.size ?? 0) > MAX_FILE_BYTES);
  if (oversized) {
    throw new GithubApiError({
      code: "too_large",
      message: `${oversized.path} is larger than 5 MB`,
    });
  }

  const changed = await mapLimit<(typeof toFetch)[number], PulledFile>(
    toFetch,
    BLOB_CONCURRENCY,
    async (blob) => {
      const data = await githubApi.get<{ content: string; encoding: string }>({
        endpoint: `${repoBase(ref)}/git/blobs/${blob.sha}`,
      });
      const content =
        data.encoding === "base64"
          ? Buffer.from(data.content, "base64").toString("utf8")
          : data.content;
      return { path: blob.path, sha: blob.sha, content };
    },
  );

  return {
    headSha,
    changed,
    deleted: Object.keys(known).filter((p) => inScope(p) && !(p in files)),
    files,
  };
}

// ---------------------------------------------------------------------------
// Commit

function conflict(remoteHeadSha: string | null, message: string): never {
  throw new GithubApiError({
    code: "conflict",
    message,
    remoteHeadSha: remoteHeadSha ?? undefined,
  });
}

/**
 * Creates the first commit of an empty repository. The Git Data API can't
 * write to a repo with no commits, so the first file goes through the Contents
 * API; the remaining changes are then committed on top of it.
 */
async function bootstrapEmptyRepo(
  ref: GithubRepoRef,
  message: string,
  first: FileChange & { content: string },
) {
  const data = await githubApi.put<{ commit: { sha: string } }>({
    endpoint: `${repoBase(ref)}/contents/${first.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    body: {
      message,
      content: Buffer.from(first.content, "utf8").toString("base64"),
      branch: ref.branch,
    },
  });
  return data.commit.sha;
}

/** Commits all changes as one commit and moves the branch without force. */
export async function commitFiles(
  input: unknown,
): Promise<CommitFilesResponse> {
  const ref = validRepoRef(input);
  const params = input as CommitFilesParams;
  if (typeof params.message !== "string" || !params.message.trim()) {
    invalid("Commit message is required");
  }
  const message = params.message.trim().slice(0, 5000);
  let changes = validChanges(params.changes);
  const expected = params.expectedHeadSha;
  if (
    expected !== undefined &&
    expected !== null &&
    typeof expected !== "string"
  ) {
    invalid("Invalid expectedHeadSha");
  }

  const written = Object.fromEntries(
    changes.map((c) => [
      c.path,
      c.content === null ? null : blobSha(c.content),
    ]),
  );

  let headSha = await getHeadSha(ref);
  if (expected !== undefined && headSha !== expected) {
    conflict(headSha, "The branch changed on GitHub since your last pull.");
  }

  if (!headSha) {
    // Empty repository: deletions are meaningless, and something must be written.
    changes = changes.filter((c) => c.content !== null);
    const first = changes.shift() as
      (FileChange & { content: string }) | undefined;
    if (!first) invalid("Nothing to write to an empty repository");
    headSha = await bootstrapEmptyRepo(ref, message, first);
    if (changes.length === 0) {
      return { commitSha: headSha, unchanged: false, files: written };
    }
  }

  const base = await githubApi.get<{ tree: { sha: string } }>({
    endpoint: `${repoBase(ref)}/git/commits/${headSha}`,
  });

  const tree = await githubApi.post<{ sha: string }>({
    endpoint: `${repoBase(ref)}/git/trees`,
    body: {
      base_tree: base.tree.sha,
      tree: changes.map((c) =>
        c.content === null
          ? { path: c.path, mode: FILE_MODE, type: "blob", sha: null }
          : { path: c.path, mode: FILE_MODE, type: "blob", content: c.content },
      ),
    },
  });

  if (tree.sha === base.tree.sha) {
    return { commitSha: headSha, unchanged: true, files: written };
  }

  const commit = await githubApi.post<{ sha: string }>({
    endpoint: `${repoBase(ref)}/git/commits`,
    body: { message, tree: tree.sha, parents: [headSha] },
  });

  try {
    await githubApi.patch({
      endpoint: `${repoBase(ref)}/git/refs/heads/${encodeBranch(ref.branch)}`,
      body: { sha: commit.sha, force: false },
    });
  } catch (error) {
    if (error instanceof GithubApiError && error.code === "conflict") {
      // Someone pushed between our read and our write. The commit object we
      // made is unreferenced and GitHub cleans it up.
      conflict(await getHeadSha(ref), "Someone pushed to this branch first.");
    }
    throw error;
  }

  return { commitSha: commit.sha, unchanged: false, files: written };
}

// ---------------------------------------------------------------------------
// IPC

/** Runs an operation and returns its result as a value, so typed errors survive IPC. */
export async function toResult<T>(
  operation: () => Promise<T>,
): Promise<GithubResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    if (error instanceof GithubApiError) {
      return { ok: false, error: error.info };
    }
    return {
      ok: false,
      error: {
        code: "unknown",
        message: error instanceof Error ? error.message : undefined,
      },
    };
  }
}
