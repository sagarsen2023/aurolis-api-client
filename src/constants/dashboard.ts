import type { RecentRequest } from "@/types/dashboard/request.type";

export const DASHBOARD_USER = { handle: "aurolis-dev" };

export const DASHBOARD_STATS = {
  requests: 11,
  collections: 2,
  savedExamples: 2,
  environments: 3,
  unsavedChanges: 0,
};

export const RECENT_REQUESTS: RecentRequest[] = [
  {
    id: "login",
    name: "Log in",
    method: "POST",
    url: "{{baseUrl}}/auth/login",
  },
  { id: "me", name: "Current user", method: "GET", url: "{{baseUrl}}/me" },
  {
    id: "list-users",
    name: "List users",
    method: "GET",
    url: "{{baseUrl}}/users",
  },
  {
    id: "get-user",
    name: "Get user",
    method: "GET",
    url: "{{baseUrl}}/users/{{userId}}",
  },
];

/** Counts of sent requests by status class. */
export const RESPONSE_HEALTH = {
  ok: 0,
  clientError: 0,
  serverError: 0,
  timeout: 0,
};
