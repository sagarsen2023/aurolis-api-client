import type { KeyValue } from "../types/workspace/request.type.ts";
import type { EnvironmentVariable } from "../types/workspace/environment.type.ts";

const VARIABLE_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/g;

export type VariableScope = ReadonlyMap<string, string>;

type VariableSource = ReadonlyArray<KeyValue | EnvironmentVariable>;

export function buildScope(
  ...sourcesByPrecedence: ReadonlyArray<VariableSource | null | undefined>
): VariableScope {
  const scope = new Map<string, string>();
  for (const source of [...sourcesByPrecedence].reverse()) {
    for (const variable of source ?? []) {
      if (variable.enabled && variable.key.trim()) {
        scope.set(variable.key.trim(), variable.value);
      }
    }
  }
  return scope;
}

export function resolveText(
  text: string,
  scope: VariableScope,
  unresolved?: Set<string>,
): string {
  return text.replace(VARIABLE_PATTERN, (match, name: string) => {
    const value = scope.get(name);
    if (value !== undefined) return value;
    unresolved?.add(name);
    return match;
  });
}

export function variableNames(text: string): string[] {
  return [...text.matchAll(VARIABLE_PATTERN)].map((match) => match[1]);
}

export function unresolvedNames(values: unknown, scope: VariableScope) {
  const text = JSON.stringify(values);
  const names = new Set(variableNames(text));
  return [...names].filter((name) => !scope.has(name));
}
