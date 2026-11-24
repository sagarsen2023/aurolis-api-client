import { GITHUB_ERROR_MESSAGES } from "@/constants/github";
import type {
  GithubApiErrorCode,
  GithubApiErrorInfo,
} from "@/types/github/github-error.type";
import type {
  CommitFilesParams,
  PullFilesParams,
} from "@/types/github/github-params.type";
import type { GithubResult } from "@/types/github/github-response.type";

export class GithubApiFailure extends Error {
  readonly code: GithubApiErrorCode;
  readonly info: GithubApiErrorInfo;

  constructor(info: GithubApiErrorInfo) {
    super(GITHUB_ERROR_MESSAGES[info.code] ?? GITHUB_ERROR_MESSAGES.unknown);
    this.name = "GithubApiFailure";
    this.code = info.code;
    this.info = info;
  }
}

function bridge() {
  const github = window.aurolis?.github;
  if (!github) {
    throw new Error("GitHub sync is only available in the desktop app.");
  }
  return github;
}

/** Turns the IPC result into data, or throws GithubApiFailure with a readable message. */
async function unwrap<T>(result: Promise<GithubResult<T>>): Promise<T> {
  const response = await result;
  if (!response.ok) throw new GithubApiFailure(response.error);
  return response.data;
}

// All calls run in the Electron main process; the access token never reaches
// this code. Errors arrive as GithubApiFailure with a `code` to branch on
// (e.g. "conflict" → pull, merge, commit again).
export const githubService = {
  getInstallations: () => unwrap(bridge().installations()),

  openInstallPage: () => bridge().openInstallPage(),

  /** True when the app is installed on at least one account. */
  isInstalled: async () => (await githubService.getInstallations()).length > 0,

  getRepositories: () => unwrap(bridge().repositories()),

  pullFiles: (params: PullFilesParams) => unwrap(bridge().pull(params)),

  commitFiles: (params: CommitFilesParams) => unwrap(bridge().commit(params)),
};
