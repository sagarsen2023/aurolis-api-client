import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";
import path from "node:path";
import { getAccessToken, getAuthStatus } from "./github-auth.ts";
import type {
  GitInfo,
  WorkspaceErrorCode,
} from "../src/types/workspace/workspace-store.type.ts";

const MIN_SYSTEM_GIT = [2, 31];
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const IS_WINDOWS = process.platform === "win32";
const IS_MAC = process.platform === "darwin";

type GitBinary = {
  file: string;
  info: GitInfo;
};

export type GitRunResult = { exitCode: number; stdout: string; stderr: string };

export class GitCommandError extends Error {
  readonly code: WorkspaceErrorCode;
  readonly stderr: string;

  constructor(code: WorkspaceErrorCode, stderr: string) {
    super(stderr.trim().split("\n").at(-1) || code);
    this.name = "GitCommandError";
    this.code = code;
    this.stderr = stderr;
  }
}

function runFile(
  file: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    signal?: AbortSignal;
  } = {},
): Promise<GitRunResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      {
        cwd: options.cwd,
        env: options.env as NodeJS.ProcessEnv,
        signal: options.signal,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        const exitCode =
          error && typeof (error as { code?: unknown }).code === "number"
            ? ((error as { code: number }).code as number)
            : error
              ? -1
              : 0;
        resolve({
          exitCode,
          stdout: stdout ?? "",
          stderr: stderr || (error && exitCode === -1 ? error.message : ""),
        });
      },
    );
  });
}

function parseVersion(output: string) {
  const match = output.match(/git version (\d+)\.(\d+)(?:\.(\d+))?/);
  return match ? match.slice(1, 4).map((part) => Number(part ?? 0)) : null;
}

const atLeast = (version: number[], minimum: number[]) =>
  version[0] > minimum[0] ||
  (version[0] === minimum[0] && version[1] >= minimum[1]);

async function isExecutable(file: string) {
  try {
    await access(file, IS_WINDOWS ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function systemGitCandidates() {
  if (IS_WINDOWS) {
    const programFiles = [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA &&
        path.join(process.env.LOCALAPPDATA, "Programs"),
    ].filter((dir): dir is string => Boolean(dir));
    return [
      "git",
      ...programFiles.map((dir) => path.join(dir, "Git", "cmd", "git.exe")),
    ];
  }
  if (IS_MAC) {
    return ["/opt/homebrew/bin/git", "/usr/local/bin/git", "git"];
  }
  return ["git", "/usr/bin/git", "/usr/local/bin/git"];
}

async function macDeveloperToolsInstalled() {
  const result = await runFile("/usr/bin/xcode-select", ["-p"]);
  return result.exitCode === 0;
}

async function isUsableCandidate(candidate: string, isBareName: boolean) {
  if (!isBareName) return isExecutable(candidate);
  if (!IS_MAC) return true;
  return macDeveloperToolsInstalled();
}

async function findSystemGit(): Promise<GitBinary | null> {
  for (const candidate of systemGitCandidates()) {
    const isBareName = candidate === "git";
    const usable = await isUsableCandidate(candidate, isBareName);
    if (!usable) continue;
    const result = await runFile(candidate, ["--version"], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    const version = parseVersion(result.stdout);
    if (result.exitCode !== 0 || !version) continue;
    if (!atLeast(version, MIN_SYSTEM_GIT)) continue;
    return {
      file: candidate,
      info: { version: version.join("."), path: candidate },
    };
  }
  return null;
}

let gitBinary: Promise<GitBinary> | null = null;

function getGit() {
  gitBinary ??= findSystemGit()
    .then((found) => {
      if (found) return found;
      throw new GitCommandError(
        "git_unavailable",
        `Git ${MIN_SYSTEM_GIT.join(".")} or newer isn't installed.`,
      );
    })
    .catch((error) => {
      gitBinary = null;
      throw error;
    });
  return gitBinary;
}

export async function gitInfo(): Promise<GitInfo> {
  const git = await getGit();
  return git.info;
}

const GITHUB_HTTPS = "https://github.com/";

async function networkEnv(): Promise<Record<string, string>> {
  const auth = await getAccessToken();
  if (auth.kind !== "ready") return {};
  const basic = Buffer.from(`x-access-token:${auth.token}`).toString("base64");
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `http.${GITHUB_HTTPS}.extraheader`,
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
  };
}

const queues = new Map<string, Promise<unknown>>();

function queued<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  queues.set(key, next);
  const release = () => {
    if (queues.get(key) === next) queues.delete(key);
  };
  next.then(release, release);
  return next;
}

export function classifyGitError(stderr: string): WorkspaceErrorCode {
  const text = stderr.toLowerCase();
  if (text.includes("not a git repository")) return "not_a_repository";
  if (
    text.includes("repository not found") ||
    (text.includes("remote:") && text.includes("not found")) ||
    text.includes("could not read username for 'https://github.com'")
  ) {
    return "repository_not_found";
  }
  if (
    text.includes("authentication failed") ||
    text.includes("could not read username") ||
    text.includes("could not read password") ||
    text.includes("terminal prompts disabled") ||
    text.includes("permission denied") ||
    text.includes("the requested url returned error: 403")
  ) {
    return "auth_failed";
  }
  if (
    text.includes("could not resolve host") ||
    text.includes("failed to connect") ||
    text.includes("connection timed out") ||
    text.includes("network is unreachable") ||
    text.includes("operation timed out")
  ) {
    return "network";
  }
  if (text.includes("already exists and is not an empty directory")) {
    return "folder_exists";
  }
  if (text.includes("index.lock")) return "locked";
  return "git_failed";
}

export async function runGit(
  repoDir: string,
  args: string[],
  options: {
    network?: boolean;
    signal?: AbortSignal;
    allowFailure?: boolean;
  } = {},
): Promise<GitRunResult> {
  const git = await getGit();
  return queued(path.resolve(repoDir), async () => {
    const env = {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
      GCM_INTERACTIVE: "never",
      ...(options.network ? await networkEnv() : {}),
    };
    const result = await runFile(git.file, args, {
      cwd: repoDir,
      env,
      signal: options.signal,
    });
    if (options.signal?.aborted) {
      throw new GitCommandError("cancelled", "Cancelled.");
    }
    if (result.exitCode !== 0 && !options.allowFailure) {
      throw new GitCommandError(classifyGitError(result.stderr), result.stderr);
    }
    return result;
  });
}

const CLONE_URL_PATTERNS = [
  /^https:\/\/[^\s/@]+(?::\d+)?\/[^\s]+$/,
  /^ssh:\/\/[^\s]+$/,
  /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[^\s]+$/,
];

const GITHUB_SHORTHAND =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?(?:[#?].*)?$/i;
const OWNER_REPO =
  /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/;

export function normalizeCloneUrl(input: string): string | null {
  const value = input.trim().replace(/\.git\/?$/, ".git");
  const shorthand = value.match(OWNER_REPO);
  if (shorthand) {
    return `https://github.com/${shorthand[1]}/${shorthand[2].replace(/\.git$/, "")}.git`;
  }
  const github = value.match(GITHUB_SHORTHAND);
  if (github) {
    return `https://github.com/${github[1]}/${github[2]}.git`;
  }
  return CLONE_URL_PATTERNS.some((pattern) => pattern.test(value))
    ? value
    : null;
}

export function parseGithubRemote(url: string) {
  const match =
    url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i) ??
    url.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i) ??
    url.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  return match ? { owner: match[1], repo: match[2] } : null;
}

export function repoNameFromUrl(url: string) {
  const last =
    url
      .replace(/[/\\]+$/, "")
      .split(/[/:]/)
      .at(-1) ?? "";
  return last.replace(/\.git$/i, "") || "workspace";
}

export const sameRemote = (a: string, b: string) => {
  const key = (url: string) => {
    const github = parseGithubRemote(url);
    return github
      ? `github.com/${github.owner}/${github.repo}`.toLowerCase()
      : url
          .replace(/\.git$/i, "")
          .replace(/\/+$/, "")
          .toLowerCase();
  };
  return key(a) === key(b);
};

export async function cloneRepository(
  url: string,
  targetDir: string,
  signal?: AbortSignal,
) {
  await runGit(
    path.dirname(targetDir),
    ["clone", "--filter=blob:none", "--", url, targetDir],
    { network: true, signal },
  );
}

export async function isRepository(dir: string) {
  const result = await runGit(dir, ["rev-parse", "--show-toplevel"], {
    allowFailure: true,
  });
  return result.exitCode === 0 ? path.resolve(result.stdout.trim()) : null;
}

export async function initRepository(dir: string) {
  await runGit(dir, ["init", "--initial-branch=main"]);
}

export async function configureManagedRepository(dir: string) {
  await runGit(dir, ["config", "core.autocrlf", "false"]);
  if (IS_WINDOWS) await runGit(dir, ["config", "core.longpaths", "true"]);
}

export async function remoteUrl(dir: string) {
  const result = await runGit(dir, ["config", "--get", "remote.origin.url"], {
    allowFailure: true,
  });
  return result.exitCode === 0 ? result.stdout.trim() || null : null;
}

export async function currentBranch(dir: string) {
  const result = await runGit(dir, ["symbolic-ref", "--short", "-q", "HEAD"], {
    allowFailure: true,
  });
  return result.exitCode === 0 ? result.stdout.trim() || null : null;
}

export async function changedFileCount(dir: string, root: string) {
  const result = await runGit(
    dir,
    [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--",
      root || ".",
    ],
    { allowFailure: true },
  );
  if (result.exitCode !== 0) return 0;
  return result.stdout.split("\0").filter(Boolean).length;
}

export async function unpushedCommitCount(dir: string) {
  const upstream = await runGit(
    dir,
    ["rev-list", "--count", "@{upstream}..HEAD"],
    { allowFailure: true },
  );
  if (upstream.exitCode === 0) return Number(upstream.stdout.trim()) || 0;
  const all = await runGit(dir, ["rev-list", "--count", "HEAD"], {
    allowFailure: true,
  });
  return all.exitCode === 0 ? Number(all.stdout.trim()) || 0 : 0;
}

async function configValue(dir: string, key: string) {
  const result = await runGit(dir, ["config", "--get", key], {
    allowFailure: true,
  });
  return result.exitCode === 0 ? result.stdout.trim() || null : null;
}

async function commitIdentity(dir: string) {
  const [name, email] = await Promise.all([
    configValue(dir, "user.name"),
    configValue(dir, "user.email"),
  ]);
  if (name && email) return [];
  const status = await getAuthStatus();
  const user = status.user;
  const fallbackName = user ? user.name || user.login : "Aurolis";
  const fallbackEmail =
    user?.id !== undefined
      ? `${user.id}+${user.login}@users.noreply.github.com`
      : "aurolis@users.noreply.localhost";
  return [
    "-c",
    `user.name=${name ?? fallbackName}`,
    "-c",
    `user.email=${email ?? fallbackEmail}`,
  ];
}

export async function commitAll(dir: string, message: string, root = "") {
  await runGit(dir, ["add", "--all", "--", root || "."]);
  const identity = await commitIdentity(dir);
  await runGit(dir, [...identity, "commit", "-m", message]);
}

export async function hasCommits(dir: string) {
  const result = await runGit(dir, ["rev-parse", "--verify", "-q", "HEAD"], {
    allowFailure: true,
  });
  return result.exitCode === 0;
}

export async function addRemote(dir: string, url: string) {
  await runGit(dir, ["remote", "add", "origin", url]);
}

export async function removeRemote(dir: string) {
  await runGit(dir, ["remote", "remove", "origin"], { allowFailure: true });
}

export async function pushNewBranch(dir: string, branch: string) {
  await runGit(
    dir,
    ["push", "--set-upstream", "origin", `refs/heads/${branch}`],
    { network: true },
  );
}
