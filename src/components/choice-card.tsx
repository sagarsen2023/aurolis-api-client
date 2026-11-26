import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ChoiceCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
}: Readonly<{
  selected: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  title: string;
  description: ReactNode;
}>) {
  return (
    <Button
      type="button"
      variant="ghost"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "h-auto w-full items-start justify-start gap-3 rounded-2xl border px-4 py-3.5 text-left font-normal whitespace-normal",
        selected
          ? "border-vio bg-surface-selected hover:bg-surface-selected"
          : "border-line bg-card hover:bg-surface-hover",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-icon text-ink">
        <Icon className="size-4" strokeWidth={1.8} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] text-foreground">
          {title}
        </span>
        <span className="block text-[13px] text-mute">{description}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-1 size-4 shrink-0 rounded-full border",
          selected ? "border-[5px] border-vio" : "border-line-strong",
        )}
      />
    </Button>
  );
}
