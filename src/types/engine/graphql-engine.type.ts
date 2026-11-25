import type { HeaderPair } from "./engine.type.ts";
import type { HttpResponseData } from "./http-engine.type.ts";

export interface GraphqlSendParams {
  runId: string;
  url: string;
  headers: HeaderPair[];
  query: string;
  variables: string;
  operationName: string;
  timeoutMs: number;
}

export interface GraphqlResponseData {
  response: HttpResponseData;
  errorCount: number | null;
}

export interface GraphqlIntrospectParams {
  url: string;
  headers: HeaderPair[];
  timeoutMs: number;
}

export interface GraphqlArgument {
  name: string;
  type: string;
}

export interface GraphqlField {
  name: string;
  type: string;
  description: string | null;
  args: GraphqlArgument[];
}

export interface GraphqlSchemaSummary {
  query: GraphqlField[];
  mutation: GraphqlField[];
  subscription: GraphqlField[];
}
