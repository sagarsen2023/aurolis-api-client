import type { GithubApiErrorCode } from "@/types/github/github-error.type";

export const GITHUB_ERROR_MESSAGES: Record<GithubApiErrorCode, string> = {
  signed_out: "Your GitHub session ended. Sign in again to sync.",
  offline:
    "Couldn't reach GitHub. Your work is saved locally; sync again when you're online.",
  rate_limited: "GitHub's rate limit was reached. Try again in a few minutes.",
  not_installed:
    "Aurolis isn't installed on this repository. Install the GitHub App on it and try again.",
  not_found: "That repository or branch doesn't exist.",
  forbidden: "You don't have permission to do that on this repository.",
  conflict:
    "Someone pushed to this branch since your last sync. Pull their changes, then commit again.",
  empty_repository: "This repository is empty.",
  too_large: "This is too large to sync through GitHub's API.",
  validation: "GitHub rejected the request.",
  invalid_input: "Aurolis sent an invalid request.",
  server: "GitHub is having problems right now. Try again shortly.",
  unknown: "Something went wrong talking to GitHub. Try again.",
};
