export const IS_MAC = window.aurolis?.platform === "darwin";

export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl";

export function isModEnter(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
}) {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}
