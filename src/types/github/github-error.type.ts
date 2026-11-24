export type GithubApiErrorCode =
  | "signed_out"
  | "offline"
  | "rate_limited"
  | "not_installed"
  | "not_found"
  | "forbidden"
  | "conflict"
  | "empty_repository"
  | "too_large"
  | "validation"
  | "invalid_input"
  | "server"
  | "unknown";

export interface GithubApiErrorInfo {
  code: GithubApiErrorCode;
  /** HTTP status from GitHub, when there was a response. */
  status?: number;
  /** GitHub's own message, for logs and details views. */
  message?: string;
  /** rate_limited: epoch ms when requests are allowed again. */
  resetAt?: number;
  /** conflict: the branch head on GitHub, to pull and merge before retrying. */
  remoteHeadSha?: string;
}
