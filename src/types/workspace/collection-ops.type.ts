import type {
  ApiRequest,
  KeyValue,
  RequestAuth,
  RequestExample,
  RequestProtocol,
} from "./request.type.ts";
import type { OpenedWorkspace } from "./workspace-store.type.ts";

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type SavedRequest = DistributiveOmit<ApiRequest, "type" | "examples">;

export type ExampleInput = Omit<RequestExample, "id" | "seq">;

export interface CollectionSettings {
  name: string;
  description: string;
  auth: RequestAuth;
  variables: KeyValue[];
}

export interface FolderSettings {
  name: string;
  description: string;
  auth: RequestAuth;
}

export type CollectionOp =
  | { op: "update-workspace"; description: string }
  | { op: "create-collection"; name: string; description: string }
  | { op: "update-collection"; id: string; settings: CollectionSettings }
  | { op: "delete-collection"; id: string }
  | { op: "create-folder"; parentId: string; name: string }
  | { op: "update-folder"; id: string; settings: FolderSettings }
  | { op: "delete-folder"; id: string }
  | {
      op: "create-request";
      parentId: string;
      name: string;
      protocol: RequestProtocol;
    }
  | { op: "save-request"; request: SavedRequest }
  | { op: "duplicate-request"; id: string }
  | { op: "delete-request"; id: string }
  | { op: "create-example"; requestId: string; example: ExampleInput }
  | { op: "update-example"; id: string; example: ExampleInput }
  | { op: "delete-example"; id: string };

export type CollectionOpName = CollectionOp["op"];

export interface ApplyCollectionOpParams {
  workspaceId: string;
  op: CollectionOp;
}

export interface CollectionOpResult {
  workspace: OpenedWorkspace;
  createdId: string | null;
}
