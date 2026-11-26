export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "installing"
  | "error";

export interface AvailableUpdate {
  version: string;
  currentVersion: string;
  date: string | null;
  notes: string;
}

export interface UpdateState {
  phase: UpdatePhase;
  update: AvailableUpdate | null;
  progress: number | null;
  error: string | null;
  checkedAt: string | null;
}
