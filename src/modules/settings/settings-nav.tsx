import {
  Database,
  Keyboard,
  SlidersHorizontal,
  Sparkles,
  SunMoon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SettingsSectionId } from "@/constants/settings";

const ITEMS: ReadonlyArray<{
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "appearance", label: "Appearance", icon: SunMoon },
  { id: "assistants", label: "AI assistants", icon: Sparkles },
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "data", label: "Data", icon: Database },
];

export function SettingsNav({
  active,
  onSelect,
}: Readonly<{
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}>) {
  return (
    <nav aria-label="Settings sections" className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-full px-3 text-left text-[14px] transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-surface-selected font-medium text-foreground"
                : "text-mute hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
