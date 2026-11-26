import { safeStorage } from "electron";
import { readFile } from "node:fs/promises";
import type { Environment } from "../src/types/workspace/environment.type.ts";
import type { WorkspaceData } from "../src/types/workspace/workspace.type.ts";
import { osKeychainAvailable } from "./keychain.ts";
import { stateFile, writeAtomic } from "./user-data.ts";

type EnvironmentSecrets = Record<string, string>;
type WorkspaceSecrets = Record<string, EnvironmentSecrets>;

const SECRETS_FILE = "secrets.bin";
const MIN_LEAK_LENGTH = 4;

const cache = new Map<string, WorkspaceSecrets>();

const secretsFile = (workspaceId: string) =>
  stateFile(workspaceId, SECRETS_FILE);

function isSecretMap(value: unknown): value is WorkspaceSecrets {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      Object.values(entry).every((secret) => typeof secret === "string"),
  );
}

async function readSecrets(workspaceId: string): Promise<WorkspaceSecrets> {
  if (!osKeychainAvailable()) return {};
  try {
    const encoded = await readFile(secretsFile(workspaceId), "utf8");
    const encrypted = Buffer.from(encoded, "base64");
    const parsed: unknown = JSON.parse(safeStorage.decryptString(encrypted));
    return isSecretMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function loadSecrets(workspaceId: string) {
  const cached = cache.get(workspaceId);
  if (cached) return cached;
  const secrets = await readSecrets(workspaceId);
  cache.set(workspaceId, secrets);
  return secrets;
}

async function persist(workspaceId: string, secrets: WorkspaceSecrets) {
  cache.set(workspaceId, secrets);
  if (!osKeychainAvailable()) return;
  const encrypted = safeStorage.encryptString(JSON.stringify(secrets));
  await writeAtomic(secretsFile(workspaceId), encrypted.toString("base64"));
}

export function secretsPersisted() {
  return osKeychainAvailable();
}

function secretsOf(environment: Environment): EnvironmentSecrets {
  const entries = environment.variables
    .filter((variable) => variable.secret && variable.key.trim())
    .map((variable) => [variable.key.trim(), variable.value]);
  return Object.fromEntries(entries);
}

export async function storeEnvironmentSecrets(
  workspaceId: string,
  environments: Environment[],
) {
  const current = await loadSecrets(workspaceId);
  const next = { ...current };
  for (const environment of environments) {
    next[environment.id] = secretsOf(environment);
  }
  await persist(workspaceId, next);
}

export async function copyEnvironmentSecrets(
  workspaceId: string,
  fromId: string,
  toId: string,
) {
  const current = await loadSecrets(workspaceId);
  const source = current[fromId];
  if (!source) return;
  await persist(workspaceId, { ...current, [toId]: { ...source } });
}

export async function forgetEnvironmentSecrets(
  workspaceId: string,
  environmentId: string,
) {
  const current = await loadSecrets(workspaceId);
  if (!(environmentId in current)) return;
  const next = { ...current };
  delete next[environmentId];
  await persist(workspaceId, next);
}

export function forgetWorkspaceSecrets(workspaceId: string) {
  cache.delete(workspaceId);
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

export async function mergeSecrets(
  workspaceId: string,
  data: WorkspaceData,
): Promise<WorkspaceData> {
  const secrets = await loadSecrets(workspaceId);
  return {
    ...data,
    environments: data.environments.map((environment) =>
      withSecrets(environment, secrets),
    ),
    globals: data.globals ? withSecrets(data.globals, secrets) : null,
  };
}

export async function secretValues(workspaceId: string) {
  const secrets = await loadSecrets(workspaceId);
  return Object.values(secrets)
    .flatMap((environment) => Object.values(environment))
    .filter((value) => value.length >= MIN_LEAK_LENGTH);
}
