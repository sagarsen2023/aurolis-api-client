import { GITHUB_ERROR_MESSAGES } from "@/constants/github";
import type {
  GithubApiErrorCode,
  GithubApiErrorInfo,
} from "@/types/github/github-error.type";
import type {
  CreateRepositoryParams,
  RepositoryNameParams,
} from "@/types/github/github-params.type";
import type { GithubResult } from "@/types/github/github-response.type";
import { desktopBridge } from "./config/desktop-bridge";

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

const bridge = () =>
  desktopBridge("github", "GitHub sync is only available in the desktop app.");

async function unwrap<T>(result: Promise<GithubResult<T>>): Promise<T> {
  const response = await result;
  if (!response.ok) throw new GithubApiFailure(response.error);
  return response.data;
}

export const githubService = {
  getInstallations: () => unwrap(bridge().installations()),

  openInstallPage: () => bridge().openInstallPage(),

  getRepositories: () => unwrap(bridge().repositories()),

  createRepository: (params: CreateRepositoryParams) =>
    unwrap(bridge().createRepository(params)),

  getEmptyRepository: (params: RepositoryNameParams) =>
    unwrap(bridge().emptyRepository(params)),
};
