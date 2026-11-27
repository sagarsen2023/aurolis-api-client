import { SettingRow, SettingsGroup, SettingsSection } from "./section";

const SHORTCUTS = [
  { title: "Save the open request or environment", keys: ["mod", "S"] },
  { title: "Save everything", keys: ["mod", "Shift", "S"] },
  { title: "Send the request", keys: ["mod", "Enter"] },
  { title: "Zoom in", keys: ["mod", "+"] },
  { title: "Zoom out", keys: ["mod", "-"] },
  { title: "Reset zoom to 100%", keys: ["mod", "0"] },
  { title: "Close menus and dialogs", keys: ["Esc"] },
] as const;

function modKey() {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";
}

function Keycap({ children }: Readonly<{ children: string }>) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-line bg-surface-raise px-1.5 font-mono text-[11px] text-mute">
      {children}
    </kbd>
  );
}

export function ShortcutsSection() {
  const mod = modKey();

  return (
    <SettingsSection id="shortcuts" title="Keyboard shortcuts">
      <SettingsGroup>
        {SHORTCUTS.map((shortcut) => (
          <SettingRow key={shortcut.title} title={shortcut.title}>
            <span className="flex items-center gap-1">
              {shortcut.keys.map((key) => (
                <Keycap key={key}>{key === "mod" ? mod : key}</Keycap>
              ))}
            </span>
          </SettingRow>
        ))}
      </SettingsGroup>
    </SettingsSection>
  );
}
