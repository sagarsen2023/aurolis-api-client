import type { Environment } from "@/types/workspace/environment.type";
import type { WorkspaceData } from "@/types/workspace/workspace.type";

export type EnvironmentSecrets = Record<string, string>;
export type WorkspaceSecrets = Record<string, EnvironmentSecrets>;

export function secretsOf(environment: Environment): EnvironmentSecrets {
  const entries = environment.variables
    .filter((variable) => variable.secret && variable.key.trim())
    .map((variable) => [variable.key.trim(), variable.value]);
  return Object.fromEntries(entries);
}

function withSecrets(
  environment: Environment,
  secrets: WorkspaceSecrets,
): Environment {
  const stored = secrets[environment.id] ?? {};
  return {
    ...environment,
    variables: environment.variables.map((variable) =>
      variable.secret
        ? { ...variable, value: stored[variable.key.trim()] ?? "" }
        : variable,
    ),
  };
}

export function mergeSecrets(
  data: WorkspaceData,
  secrets: WorkspaceSecrets,
): WorkspaceData {
  return {
    ...data,
    environments: data.environments.map((environment) =>
      withSecrets(environment, secrets),
    ),
    globals: data.globals ? withSecrets(data.globals, secrets) : null,
  };
}
