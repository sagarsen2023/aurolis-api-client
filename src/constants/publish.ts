export const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export const REPO_NAME_FALLBACK = "aurolis-workspace";

export const REPO_NAME_ERRORS = {
  empty: "Enter a repository name.",
  tooLong: "Use 100 characters or fewer.",
  characters: "Use only letters, numbers, dots, hyphens and underscores.",
  dots: "A repository name can't be only dots.",
} as const;

export const GITHUB_NEW_REPO_URL = "https://github.com/new";
