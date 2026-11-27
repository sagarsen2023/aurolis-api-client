import type { HeaderPair } from "../engine/engine.type.ts";
import type { PreparedBody } from "../engine/http-engine.type.ts";
import type {
  HttpMethod,
  KeyValue,
  RequestAuth,
  RequestBody,
} from "../workspace/request.type.ts";

export interface CurlImport {
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: RequestBody;
  auth: RequestAuth | null;
}

export interface CurlTarget {
  method: HttpMethod;
  url: string;
  headers: HeaderPair[];
  body: PreparedBody;
}
