import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: Readonly<{
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-fit gap-0.5 rounded-full border border-line bg-surface-2 p-[3px]"
    >
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="ghost"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-7.5 rounded-full px-3 text-[13px] font-normal",
            value === option.value
              ? "bg-card text-foreground shadow-xs hover:bg-card"
              : "text-mute hover:bg-transparent hover:text-foreground",
          )}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
