export const REQUEST_TIMEOUTS = [
  { value: "10", label: "10 seconds" },
  { value: "30", label: "30 seconds" },
  { value: "60", label: "60 seconds" },
  { value: "120", label: "2 minutes" },
] as const;

export const DEFAULT_REQUEST_TIMEOUT = "30";

export const SETTINGS_SECTION_IDS = [
  "appearance",
  "assistants",
  "general",
  "shortcuts",
  "data",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];
