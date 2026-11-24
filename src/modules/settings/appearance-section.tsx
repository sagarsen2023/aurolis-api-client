import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/theme-context";
import { SettingsSection } from "./section";

const THEMES = [
  {
    id: "dark",
    label: "Dark",
    icon: Moon,
    hint: "Active",
  },
  {
    id: "light",
    label: "Light",
    icon: Sun,
    hint: null,
  },
  {
    id: "system",
    label: "System",
    icon: Monitor,
    hint: null,
  },
] as const;

function Preview({ theme }: Readonly<{ theme: "dark" | "light" | "system" }>) {
  if (theme === "system") {
    return (
      <div className="grid h-[72px] grid-cols-2 overflow-hidden rounded-xl border border-line">
        <div className="flex flex-col justify-center gap-2 bg-[#161417] px-3">
          <span className="h-1.5 w-10 rounded-full bg-white/80" />
          <span className="h-1.5 w-14 rounded-full bg-lav" />
        </div>
        <div className="flex flex-col justify-center gap-2 bg-white px-3">
          <span className="h-1.5 w-10 rounded-full bg-neutral-300" />
          <span className="h-1.5 w-14 rounded-full bg-[#e7c8f8]" />
        </div>
      </div>
    );
  }

  const dark = theme === "dark";
  return (
    <div
      className={cn(
        "flex h-[72px] flex-col justify-center gap-2 rounded-xl border border-line px-3",
        dark ? "bg-[#161417]" : "bg-white",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-16 rounded-full",
          dark ? "bg-white/75" : "bg-neutral-300",
        )}
      />
      <span
        className={cn(
          "h-1.5 w-24 rounded-full",
          dark ? "bg-lav" : "bg-[#e7c8f8]",
        )}
      />
    </div>
  );
}

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <SettingsSection
      id="appearance"
      title="Appearance"
      description="Dark is the Aurolis default. System follows your device."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {THEMES.map((option) => {
          const Icon = option.icon;
          const selected = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setTheme(option.id)}
              className={cn(
                "rounded-2xl border bg-card p-3 text-left transition-colors outline-none",
                "hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-lav ring-1 ring-lav" : "border-line",
              )}
            >
              <Preview theme={option.id} />
              <span className="mt-3 flex items-center justify-between gap-2 text-[14px]">
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <Icon className="size-3.5 text-mute" strokeWidth={1.8} />
                  {option.label}
                </span>
                {selected ? (
                  <span className="rounded-full bg-lav px-2 py-0.5 text-[11px] font-medium text-lav-ink">
                    Active
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </SettingsSection>
  );
}
