import type {
  RunState,
  TypescriptSource,
} from "../context/collections-context.ts";
import { prettyJson } from "../utils/json.ts";

export function payloadSource(
  json: string,
  rootName: string,
  label = "Request payload",
): TypescriptSource | null {
  if (!json.trim()) return null;
  return { id: "payload", label, json, rootName };
}

export function responseSource(
  state: RunState,
  rootName: string,
): TypescriptSource | null {
  if (state.status !== "done") return null;
  const { response } = state;
  if (response.bodyEncoding !== "text") return null;
  if (prettyJson(response.body) === null) return null;
  return { id: "response", label: "Response", json: response.body, rootName };
}
