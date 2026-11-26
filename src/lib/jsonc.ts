export type JsonComment = { from: number; to: number };

const WHITESPACE = new Set([" ", "\t", "\r", "\n"]);
const PUNCTUATION = new Set(["{", "}", "[", "]", ",", ":"]);
const INDENT = "  ";

export function jsonCommentEnd(text: string, index: number): number | null {
  if (text.startsWith("//", index)) {
    let end = index + 2;
    while (end < text.length && text[end] !== "\n" && text[end] !== "\r") {
      end += 1;
    }
    return end;
  }
  if (text.startsWith("/*", index)) {
    const close = text.indexOf("*/", index + 2);
    return close === -1 ? text.length : close + 2;
  }
  return null;
}

function scanJson(text: string) {
  const comments: JsonComment[] = [];
  const orphanCommas: number[] = [];
  let pendingComma = -1;
  let commentAfterComma = false;
  let inString = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (inString) {
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === '"') inString = false;
      index += 1;
      continue;
    }
    const end = jsonCommentEnd(text, index);
    if (end !== null) {
      comments.push({ from: index, to: end });
      if (pendingComma !== -1) commentAfterComma = true;
      index = end;
      continue;
    }
    if (!WHITESPACE.has(char)) {
      if (commentAfterComma && (char === "}" || char === "]")) {
        orphanCommas.push(pendingComma);
      }
      pendingComma = char === "," ? index : -1;
      commentAfterComma = false;
      if (char === '"') inString = true;
    }
    index += 1;
  }
  return { comments, orphanCommas };
}

export function findJsonComments(text: string): JsonComment[] {
  return scanJson(text).comments;
}

export function blankJsonComments(text: string): string {
  const { comments, orphanCommas } = scanJson(text);
  if (comments.length === 0) return text;
  const chars = text.split("");
  for (const { from, to } of comments) {
    for (let index = from; index < to; index += 1) {
      if (chars[index] !== "\n" && chars[index] !== "\r") chars[index] = " ";
    }
  }
  for (const index of orphanCommas) chars[index] = " ";
  return chars.join("");
}

export function stripJsonComments(text: string): string {
  const blanked = blankJsonComments(text);
  if (blanked === text) return text;
  const original = text.split("\n");
  return blanked
    .split("\n")
    .flatMap((line, index) => {
      if (line === original[index]) return [line];
      if (!line.trim()) return [];
      const eol = line.endsWith("\r") ? "\r" : "";
      return [line.trimEnd() + eol];
    })
    .join("\n");
}

type Token = {
  kind: "value" | "punctuation" | "line-comment" | "block-comment";
  text: string;
  sameLine: boolean;
};

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let sameLine = true;
  let index = 0;
  const push = (kind: Token["kind"], end: number) => {
    tokens.push({ kind, text: text.slice(index, end), sameLine });
    sameLine = true;
    index = end;
  };
  while (index < text.length) {
    const char = text[index];
    if (WHITESPACE.has(char)) {
      if (char === "\n") sameLine = false;
      index += 1;
      continue;
    }
    const commentEnd = jsonCommentEnd(text, index);
    if (commentEnd !== null) {
      push(
        text[index + 1] === "/" ? "line-comment" : "block-comment",
        commentEnd,
      );
      continue;
    }
    if (PUNCTUATION.has(char)) {
      push("punctuation", index + 1);
      continue;
    }
    let end = index + 1;
    if (char === '"') {
      while (end < text.length && text[end] !== '"') {
        end += text[end] === "\\" ? 2 : 1;
      }
      end = Math.min(end + 1, text.length);
    } else {
      while (
        end < text.length &&
        !WHITESPACE.has(text[end]) &&
        !PUNCTUATION.has(text[end]) &&
        text[end] !== '"' &&
        jsonCommentEnd(text, end) === null
      ) {
        end += 1;
      }
    }
    push("value", end);
  }
  return tokens;
}

const CLOSING: Record<string, string> = { "{": "}", "[": "]" };

export function formatJsonc(text: string): string {
  const tokens = tokenize(text);
  let out = "";
  let depth = 0;
  let breakBefore = false;
  let spaceBefore = false;
  const lineBreak = () => `\n${INDENT.repeat(depth)}`;
  const lead = () => {
    if (breakBefore && out) out += lineBreak();
    else if (spaceBefore) out += " ";
    breakBefore = false;
    spaceBefore = false;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind === "line-comment" || token.kind === "block-comment") {
      if (token.sameLine && out) {
        out += `${out.endsWith(" ") ? "" : " "}${token.text}`;
      } else {
        if (out) out += lineBreak();
        out += token.text;
      }
      const ownLine = !token.sameLine || token.kind === "line-comment";
      breakBefore = breakBefore || ownLine;
      spaceBefore = !breakBefore;
      continue;
    }
    if (token.kind === "value") {
      lead();
      out += token.text;
      continue;
    }
    switch (token.text) {
      case "{":
      case "[": {
        lead();
        out += token.text;
        const next = tokens[index + 1];
        if (next?.kind === "punctuation" && next.text === CLOSING[token.text]) {
          out += next.text;
          index += 1;
        } else {
          depth += 1;
          breakBefore = true;
        }
        break;
      }
      case "}":
      case "]":
        depth = Math.max(depth - 1, 0);
        out += lineBreak() + token.text;
        breakBefore = false;
        spaceBefore = false;
        break;
      case ",":
        out += ",";
        breakBefore = true;
        spaceBefore = false;
        break;
      default:
        out += ": ";
        breakBefore = false;
        spaceBefore = false;
    }
  }
  return out;
}
