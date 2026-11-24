export type GithubApiErrorCode =
  | "signed_out"
  | "offline"
  | "rate_limited"
  | "not_installed"
  | "not_found"
  | "forbidden"
  | "conflict"
  | "empty_repository"
  | "already_exists"
  | "not_empty"
  | "too_large"
  | "validation"
  | "invalid_input"
  | "server"
  | "unknown";

export interface GithubApiErrorInfo {
  code: GithubApiErrorCode;
  status?: number;
  message?: string;
  resetAt?: number;
  remoteHeadSha?: string;
}
