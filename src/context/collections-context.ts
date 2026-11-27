import { atom } from "jotai";
import type { EngineErrorCode } from "@/types/engine/engine.type";
import type { GraphqlSchemaResult } from "@/types/engine/graphql-engine.type";
import type { HttpResponseData } from "@/types/engine/http-engine.type";
import type { RealtimeEvent } from "@/types/engine/realtime-engine.type";
import type {
  EditorTab,
  RequestDrafts,
} from "@/types/workspace/editor-state.type";
import type { RequestProtocol } from "@/types/workspace/request.type";

export type RunState =
  | { status: "idle" }
  | { status: "running"; runId: string; startedAt: number }
  | {
      status: "done";
      response: HttpResponseData;
      graphqlErrors: number | null;
      unresolved: string[];
    }
  | { status: "error"; code: EngineErrorCode | null; message: string };

export type RealtimeStatus = "disconnected" | "connecting" | "connected";

export interface RealtimeSession {
  status: RealtimeStatus;
  connectionId: string | null;
  events: RealtimeEvent[];
}

export type TreeDialog =
  | { kind: "new-collection" }
  | { kind: "new-folder"; parentId: string; parentName: string }
  | {
      kind: "new-request";
      parentId: string;
      parentName: string;
      protocol?: RequestProtocol;
    }
  | { kind: "import-curl"; parentId: string; parentName: string }
  | { kind: "new-example"; requestId: string; requestName: string }
  | { kind: "move-collection"; id: string; name: string }
  | {
      kind: "delete";
      target: "collection" | "folder" | "request" | "example";
      id: string;
      name: string;
      detail: string | null;
    };

export const editorStateWorkspaceIdAtom = atom<string | null>(null);

export const editorTabsAtom = atom<EditorTab[]>([]);

export const activeTabIdAtom = atom<string | null>(null);

export const draftsAtom = atom<RequestDrafts>({});

export const runStatesAtom = atom<Record<string, RunState>>({});

export const realtimeSessionsAtom = atom<Record<string, RealtimeSession>>({});

export const graphqlSchemasAtom = atom<Record<string, GraphqlSchemaResult>>({});

export const expandedNodesAtom = atom<Record<string, boolean>>({});

export const treeDialogAtom = atom<TreeDialog | null>(null);

export type TypescriptSourceId = "response" | "payload";

export interface TypescriptSource {
  id: TypescriptSourceId;
  label: string;
  json: string;
  rootName: string;
}

export interface TypescriptSheetState {
  title: string;
  sources: TypescriptSource[];
  initial: TypescriptSourceId;
}

export const typescriptSheetAtom = atom<TypescriptSheetState | null>(null);

export const unsavedCountAtom = atom(
  (get) => Object.keys(get(draftsAtom)).length,
);
