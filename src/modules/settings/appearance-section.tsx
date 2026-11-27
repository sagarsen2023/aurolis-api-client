import { Minus, Monitor, Moon, Plus, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/theme-context";
import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM } from "@/constants/zoom";
import { useZoom } from "@/hooks/use-zoom";
import { SettingRow, SettingsGroup, SettingsSection } from "./section";

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
      <div className="grid h-18 grid-cols-2 overflow-hidden rounded-xl border border-line">
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
        "flex h-18 flex-col justify-center gap-2 rounded-xl border border-line px-3",
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

function ZoomControl() {
  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom();

  return (
    <SettingsGroup className="mt-4">
      <SettingRow
        title="Zoom"
        description="Scales the whole window. Also with Ctrl or ⌘ and +, - or 0."
      >
        <span className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={zoomOut}
          >
            <Minus />
          </Button>
          <span className="w-14 text-center font-mono text-sm text-foreground tabular-nums">
            {zoom}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={zoomIn}
          >
            <Plus />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-1"
            disabled={zoom === DEFAULT_ZOOM}
            onClick={resetZoom}
          >
            Reset
          </Button>
        </span>
      </SettingRow>
    </SettingsGroup>
  );
}

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <SettingsSection
      id="appearance"
      title="Appearance"
      description="Dark is the Aurolis default. System follows your device and the Claude viewer."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {THEMES.map((option) => {
          const Icon = option.icon;
          const selected = theme === option.id;
          return (
            <Button
              key={option.id}
              type="button"
              variant="ghost"
              aria-pressed={selected}
              onClick={() => setTheme(option.id)}
              className={cn(
                "h-auto flex-col items-stretch gap-0 rounded-2xl border bg-card p-3 text-left font-normal whitespace-normal hover:bg-surface-hover",
                selected ? "border-lav ring-1 ring-lav" : "border-line",
              )}
            >
              <Preview theme={option.id} />
              <span className="mt-3 flex items-center justify-between gap-2 text-sm">
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
            </Button>
          );
        })}
      </div>
      <ZoomControl />
    </SettingsSection>
  );
}
