import type { Environment, Workspace } from "@/types/workspace/workspace.type";

// Static data until the workspace and environment APIs exist.

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
