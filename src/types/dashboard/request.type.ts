import type { HttpMethod } from "../workspace/request.type.ts";

export type { HttpMethod };

export interface RecentRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
}
