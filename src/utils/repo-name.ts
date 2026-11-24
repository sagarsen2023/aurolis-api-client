import {
  REPO_NAME_ERRORS,
  REPO_NAME_FALLBACK,
  REPO_NAME_PATTERN,
} from "@/constants/publish";
import { slugify } from "@/lib/workspace-format";

export const toRepoName = (workspaceName: string) =>
  slugify(workspaceName, REPO_NAME_FALLBACK);

export function repoNameError(name: string): string | null {
  const value = name.trim();
  if (!value) return REPO_NAME_ERRORS.empty;
  if (value.length > 100) return REPO_NAME_ERRORS.tooLong;
  if (!REPO_NAME_PATTERN.test(value)) return REPO_NAME_ERRORS.characters;
  if (/^\.+$/.test(value)) return REPO_NAME_ERRORS.dots;
  return null;
}
