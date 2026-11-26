import type { Collection } from "../workspace/collection.type.ts";
import type { EnvironmentSettings } from "../workspace/collection-ops.type.ts";
import type { Environment } from "../workspace/environment.type.ts";

export type TransferFormat = "postman" | "hoppscotch";

export type ImportNote =
  | "scripts"
  | "file-fields"
  | "unsupported-auth"
  | "unsupported-body"
  | "unsupported-method"
  | "request-variables"
  | "folder-variables"
  | "inherited-headers";

export type ImportNotes = Partial<Record<ImportNote, number>>;

export type ImportedEnvironment = EnvironmentSettings;

export interface ImportBundle {
  collections: Collection[];
  environments: ImportedEnvironment[];
  notes: ImportNotes;
}

export interface ImportSource {
  name: string;
  bytes: Uint8Array;
}

export interface CredentialSummary {
  tokens: number;
  headers: number;
  variables: string[];
}

export interface ExportSelection {
  workspaceId: string;
  workspaceName: string;
  collections: Collection[];
  environments: Environment[];
}

export interface SavedExportFile {
  saved: boolean;
  path: string | null;
}

export interface ExportFile {
  name: string;
  bytes: Uint8Array;
  skippedRequests: number;
}
