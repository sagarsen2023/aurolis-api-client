import {
  CircleArrowUp,
  Database,
  Keyboard,
  SlidersHorizontal,
  Sparkles,
  SunMoon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  { id: "updates", label: "Updates", icon: CircleArrowUp },
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
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            aria-current={selected ? "true" : undefined}
            onClick={() => onSelect(item.id)}
            className={cn(
              "h-9 w-full justify-start gap-2.5 rounded-full px-3 text-sm font-normal",
              selected
                ? "bg-surface-selected font-medium text-foreground hover:bg-surface-selected"
                : "text-mute hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
            {item.label}
          </Button>
        );
      })}
    </nav>
  );
}
