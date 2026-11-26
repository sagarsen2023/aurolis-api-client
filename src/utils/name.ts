export const MAX_NAME_LENGTH = 200;

export function nameError(name: string) {
  if (!name.trim()) return "Enter a name.";
  if (name.trim().length > MAX_NAME_LENGTH)
    return "Use 200 characters or fewer.";
  return undefined;
}
