export type JsonTokenKind =
  "key" | "string" | "number" | "boolean" | "null" | "plain";

export interface JsonToken {
  kind: JsonTokenKind;
  text: string;
}

const TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function kindOf(match: RegExpExecArray): JsonTokenKind {
  if (match[1]) return match[2] ? "key" : "string";
  if (match[3]) return "boolean";
  if (match[4]) return "null";
  return "number";
}

export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last)
      tokens.push({ kind: "plain", text: text.slice(last, index) });
    const kind = kindOf(match);
    if (kind === "key") {
      tokens.push({ kind, text: match[1] });
      tokens.push({ kind: "plain", text: match[2] });
    } else {
      tokens.push({ kind, text: match[0] });
    }
    last = index + match[0].length;
  }
  if (last < text.length)
    tokens.push({ kind: "plain", text: text.slice(last) });
  return tokens;
}
