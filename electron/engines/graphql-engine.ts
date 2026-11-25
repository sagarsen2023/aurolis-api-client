import type { HeaderPair } from "../../src/types/engine/engine.type.ts";
import type {
  GraphqlArgument,
  GraphqlField,
  GraphqlIntrospectParams,
  GraphqlResponseData,
  GraphqlSchemaResult,
  GraphqlSendParams,
} from "../../src/types/engine/graphql-engine.type.ts";
import type { HttpResponseData } from "../../src/types/engine/http-engine.type.ts";
import {
  graphqlIntrospectSchema,
  graphqlSendSchema,
} from "../../src/validators/engine.schema.ts";
import { getIntrospectionQuery } from "graphql";
import { EngineError, parseInput } from "./engine-error.ts";
import { executeHttp } from "./http-engine.ts";

const JSON_CONTENT_TYPE = "application/json";
const GRAPHQL_ACCEPT = "application/graphql-response+json, application/json";

const INTROSPECTION_OPERATION = "IntrospectionQuery";
const INTROSPECTION_QUERY = getIntrospectionQuery({ descriptions: true });

type TypeRef = { kind: string; name: string | null; ofType?: TypeRef | null };

type IntrospectionField = {
  name: string;
  description: string | null;
  args: { name: string; type: TypeRef }[];
  type: TypeRef;
};

type IntrospectionSchema = {
  queryType: { name: string } | null;
  mutationType: { name: string } | null;
  subscriptionType: { name: string } | null;
  types: { name: string; fields: IntrospectionField[] | null }[];
};

function hasHeader(headers: HeaderPair[], name: string) {
  const lower = name.toLowerCase();
  return headers.some(([key]) => key.toLowerCase() === lower);
}

function withGraphqlHeaders(headers: HeaderPair[]): HeaderPair[] {
  const next = [...headers];
  if (!hasHeader(next, "content-type")) {
    next.push(["content-type", JSON_CONTENT_TYPE]);
  }
  if (!hasHeader(next, "accept")) next.push(["accept", GRAPHQL_ACCEPT]);
  return next;
}

function parseVariables(
  variables: string,
): Record<string, unknown> | undefined {
  if (!variables.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(variables);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    throw new EngineError(
      "invalid_variables",
      `Variables aren't valid JSON. ${detail}`.trim(),
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new EngineError(
      "invalid_variables",
      'Variables must be a JSON object, like { "id": 1 }.',
    );
  }
  return parsed as Record<string, unknown>;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function countErrors(response: HttpResponseData): number | null {
  if (response.bodyEncoding !== "text") return null;
  const payload = parseJson(response.body) as { errors?: unknown } | null;
  if (!payload || typeof payload !== "object") return null;
  return Array.isArray(payload.errors) ? payload.errors.length : 0;
}

function postGraphql(
  params: { url: string; headers: HeaderPair[]; timeoutMs: number },
  payload: Record<string, unknown>,
  runId?: string,
) {
  return executeHttp(
    {
      method: "POST",
      url: params.url,
      headers: withGraphqlHeaders(params.headers),
      body: { kind: "text", text: JSON.stringify(payload) },
      timeoutMs: params.timeoutMs,
    },
    runId,
  );
}

export async function sendGraphql(
  params: unknown,
): Promise<GraphqlResponseData> {
  const input: GraphqlSendParams = parseInput(graphqlSendSchema, params);
  if (!input.query.trim()) {
    throw new EngineError("invalid_input", "Write a query first.");
  }
  const variables = parseVariables(input.variables);
  const payload = {
    query: input.query,
    variables,
    operationName: input.operationName.trim() || undefined,
  };
  const response = await postGraphql(input, payload, input.runId);
  return { response, errorCount: countErrors(response) };
}

function formatType(ref: TypeRef | null | undefined): string {
  if (!ref) return "Unknown";
  if (ref.kind === "NON_NULL") return `${formatType(ref.ofType)}!`;
  if (ref.kind === "LIST") return `[${formatType(ref.ofType)}]`;
  return ref.name ?? "Unknown";
}

function toField(field: IntrospectionField): GraphqlField {
  const args: GraphqlArgument[] = field.args.map((arg) => ({
    name: arg.name,
    type: formatType(arg.type),
  }));
  return {
    name: field.name,
    type: formatType(field.type),
    description: field.description,
    args,
  };
}

function rootFields(schema: IntrospectionSchema, typeName: string | undefined) {
  if (!typeName) return [];
  const type = schema.types.find((candidate) => candidate.name === typeName);
  const fields = type?.fields ?? [];
  return fields.map(toField).sort((a, b) => a.name.localeCompare(b.name));
}

type IntrospectionPayload = {
  data?: { __schema?: IntrospectionSchema };
  errors?: { message?: string }[];
};

function readIntrospection(response: HttpResponseData) {
  const payload = parseJson(response.body) as IntrospectionPayload | null;
  const data = payload?.data;
  if (data?.__schema) return { data, schema: data.__schema };
  const firstError = payload?.errors?.[0]?.message;
  const reason =
    firstError ?? `The server answered ${response.status} without a schema.`;
  throw new EngineError("unknown", `Introspection failed: ${reason}`);
}

export async function introspectGraphql(
  params: unknown,
): Promise<GraphqlSchemaResult> {
  const input: GraphqlIntrospectParams = parseInput(
    graphqlIntrospectSchema,
    params,
  );
  const response = await postGraphql(input, {
    query: INTROSPECTION_QUERY,
    operationName: INTROSPECTION_OPERATION,
  });
  const { data, schema } = readIntrospection(response);
  return {
    summary: {
      query: rootFields(schema, schema.queryType?.name),
      mutation: rootFields(schema, schema.mutationType?.name),
      subscription: rootFields(schema, schema.subscriptionType?.name),
    },
    introspection: data,
  };
}
