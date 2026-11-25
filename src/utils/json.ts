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

type Placeholder = { token: string; original: string; quoted: boolean };

const VARIABLE_START = "{{";
const VARIABLE_END = "}}";

function placeholderToken(index: number) {
  return `__aurolis_variable_${index}__`;
}

function maskVariables(text: string) {
  const placeholders: Placeholder[] = [];
  let masked = "";
  let inString = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (inString && char === "\\") {
      masked += text.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (char === '"') inString = !inString;
    const end = text.startsWith(VARIABLE_START, index)
      ? text.indexOf(VARIABLE_END, index + VARIABLE_START.length)
      : -1;
    if (end === -1) {
      masked += char;
      index += 1;
      continue;
    }
    const original = text.slice(index, end + VARIABLE_END.length);
    const token = placeholderToken(placeholders.length);
    placeholders.push({ token, original, quoted: !inString });
    masked += inString ? token : `"${token}"`;
    index = end + VARIABLE_END.length;
  }
  return { masked, placeholders };
}

export function formatJson(text: string): string | null {
  const { masked, placeholders } = maskVariables(text);
  const formatted = prettyJson(masked);
  if (formatted === null) return null;
  return placeholders.reduce(
    (result, { token, original, quoted }) =>
      result.replace(quoted ? `"${token}"` : token, original),
    formatted,
  );
}

const VARIABLE_VALUE = Symbol("variable");

export function parseJsonWithVariables(
  text: string,
): { ok: true; value: unknown } | { ok: false } {
  const { masked, placeholders } = maskVariables(text);
  const unquoted = new Set(
    placeholders.filter((entry) => entry.quoted).map((entry) => entry.token),
  );
  try {
    const value: unknown = JSON.parse(masked, (_key, entry: unknown) =>
      typeof entry === "string" && unquoted.has(entry) ? VARIABLE_VALUE : entry,
    );
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}
