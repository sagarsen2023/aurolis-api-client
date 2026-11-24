import type { Collection } from "./collection.type.ts";
import type { Environment } from "./environment.type.ts";

export type { Environment } from "./environment.type.ts";

export interface Workspace {
  id: string;
  name: string;
  plan: "Personal" | "Team";
}

export interface WorkspaceManifest {
  format: number;
  workspace: { id: string; name: string };
  defaultEnvironment: string | null;
}

export interface WorkspaceData {
  manifest: WorkspaceManifest;
  collections: Collection[];
  environments: Environment[];
  globals: Environment | null;
}
