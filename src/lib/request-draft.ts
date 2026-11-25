import type { SavedRequest } from "../types/workspace/collection-ops.type.ts";
import type { ApiRequest } from "../types/workspace/request.type.ts";
import { stableStringify } from "./workspace-format.ts";

export function toSavedRequest(request: ApiRequest): SavedRequest {
  const { type: _type, examples: _examples, ...saved } = request;
  return saved;
}

export function isSameRequest(a: SavedRequest, b: SavedRequest) {
  return stableStringify(a) === stableStringify(b);
}
