import {
  createManifest,
  fromFiles,
  MANIFEST_PATH,
  stableStringify,
} from "@/lib/workspace-format";
import type {
  OpenedWorkspace,
  WorkspaceEntry,
  WorkspaceGitState,
  WorkspaceRegistryView,
} from "@/types/workspace/workspace-store.type";
import { run } from "./invoke";
import { BridgeError } from "./results";
import { mergeSecrets, type WorkspaceSecrets } from "./secrets";

const OVERSIZED_MESSAGE = "Larger than 5 MB; not loaded.";

interface OpenedRaw {
  entry: WorkspaceEntry;
  displayPath: string;
  files: Record<string, string>;
  oversized: string[];
  git: WorkspaceGitState;
  secrets: WorkspaceSecrets;
  secretsPersisted: boolean;
}

export interface WorkspaceFileSet {
  files: Record<string, string>;
  oversized: string[];
}

export function manifestFor(name: string) {
  return stableStringify(createManifest(crypto.randomUUID(), name.trim()));
}

export async function openWorkspace(id: string): Promise<OpenedWorkspace> {
  const raw = await run<OpenedRaw>("workspace_open", { id });
  const isWorkspace = MANIFEST_PATH in raw.files;
  const parsed = fromFiles(raw.files);
  return {
    entry: raw.entry,
    displayPath: raw.displayPath,
    isWorkspace,
    data: isWorkspace ? mergeSecrets(parsed.workspace, raw.secrets) : null,
    issues: [
      ...(isWorkspace ? parsed.issues : []),
      ...raw.oversized.map((path) => ({ path, message: OVERSIZED_MESSAGE })),
    ],
    git: raw.git,
    secretsPersisted: raw.secretsPersisted,
  };
}

export function readWorkspaceFiles(id: string) {
  return run<WorkspaceFileSet>("workspace_read_files", { id });
}

export async function findEntry(id: string): Promise<WorkspaceEntry> {
  const view = await run<WorkspaceRegistryView>("workspace_list");
  const entry = view.workspaces.find((candidate) => candidate.id === id);
  if (!entry) throw new BridgeError("not_found");
  return entry;
}

export async function createWorkspace(name: string, activate = true) {
  return run<{ workspaceId: string }>("workspace_create", {
    params: { name, manifest: manifestFor(name), activate },
  });
}

export async function initializeWorkspace(id: string) {
  const entry = await findEntry(id);
  await run<null>("workspace_initialize", {
    id,
    manifest: manifestFor(entry.name),
  });
  return openWorkspace(id);
}
