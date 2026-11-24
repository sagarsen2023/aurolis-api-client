export type HttpMethod =
  "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export type RequestBody =
  | { mode: "none" }
  | { mode: "json" | "text" | "xml"; raw: string }
  | { mode: "urlencoded" | "form-data"; fields: KeyValue[] };

export type RequestAuth =
  | { type: "inherit" }
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | { type: "apikey"; key: string; value: string; in: "header" | "query" };

export interface RequestExample {
  id: string;
  name: string;
  seq: number;
  status: number;
  headers: KeyValue[];
  body: string;
}

export interface ApiRequest {
  type: "request";
  id: string;
  name: string;
  seq: number;
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: RequestBody;
  auth: RequestAuth;
  examples: RequestExample[];
}
