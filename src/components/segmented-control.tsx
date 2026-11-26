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
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-7.5 rounded-full px-3 text-[13px] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
            value === option.value
              ? "bg-card text-foreground shadow-xs"
              : "text-mute hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
