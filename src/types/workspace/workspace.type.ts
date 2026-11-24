export interface Workspace {
  id: string;
  name: string;
  plan: "Personal" | "Team";
}

export interface Environment {
  id: string;
  name: string;
}
