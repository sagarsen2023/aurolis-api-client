// Static data until the workspace and environment APIs exist.

export interface Workspace {
  id: string;
  name: string;
  plan: "Personal" | "Team";
}

export interface Environment {
  id: string;
  name: string;
}

export const WORKSPACES: Workspace[] = [
  { id: "personal", name: "My workspace", plan: "Personal" },
  { id: "aurolis-team", name: "Aurolis Team", plan: "Team" },
  { id: "payments-squad", name: "Payments Squad", plan: "Team" },
];

export const ENVIRONMENTS: Environment[] = [
  { id: "local", name: "Local" },
  { id: "staging", name: "Staging" },
  { id: "production", name: "Production" },
];
