import type { EnvironmentVariable } from "@/types/workspace/environment.type";

export function variableSummary(variables: EnvironmentVariable[]) {
  const total = variables.length;
  const secrets = variables.filter((variable) => variable.secret).length;
  const count = `${total} ${total === 1 ? "variable" : "variables"}`;
  return secrets > 0 ? `${count} · ${secrets} secret` : count;
}
