export function tryParseJson(
  text: string,
): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export function prettyJson(text: string): string | null {
  const parsed = tryParseJson(text);
  if (!parsed.ok) return null;
  return JSON.stringify(parsed.value, null, 2);
}

export function isJsonContentType(contentType: string | null) {
  if (!contentType) return false;
  return /[/+]json\b/i.test(contentType);
}
