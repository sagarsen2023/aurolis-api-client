import { GITHUB_ERROR_MESSAGES } from "@/constants/github";
import type {
  GithubApiErrorCode,
  GithubApiErrorInfo,
} from "@/types/github/github-error.type";
import type {
  CommitFilesParams,
  CreateRepositoryParams,
  PullFilesParams,
  RepositoryNameParams,
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

async function unwrap<T>(result: Promise<GithubResult<T>>): Promise<T> {
  const response = await result;
  if (!response.ok) throw new GithubApiFailure(response.error);
  return response.data;
}

export const githubService = {
  getInstallations: () => unwrap(bridge().installations()),

  openInstallPage: () => bridge().openInstallPage(),

  getRepositories: () => unwrap(bridge().repositories()),

  pullFiles: (params: PullFilesParams) => unwrap(bridge().pull(params)),

  commitFiles: (params: CommitFilesParams) => unwrap(bridge().commit(params)),

  createRepository: (params: CreateRepositoryParams) =>
    unwrap(bridge().createRepository(params)),

  getEmptyRepository: (params: RepositoryNameParams) =>
    unwrap(bridge().emptyRepository(params)),
};
