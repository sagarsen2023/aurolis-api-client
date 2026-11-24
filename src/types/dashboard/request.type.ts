export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export interface RecentRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
}
