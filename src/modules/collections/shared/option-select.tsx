import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Option<T extends string> {
  value: T;
  label: string;
}

function OptionSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  label,
  className,
  triggerClassName,
}: Readonly<{
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (value: T) => void;
  ariaLabel?: string;
  label?: string;
  className?: string;
  triggerClassName?: string;
}>) {
  return (
    <div className={className}>
      <Select
        items={options.map((option) => ({ ...option }))}
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as T);
        }}
      >
        <SelectTrigger
          aria-label={ariaLabel ?? label}
          label={label}
          className={triggerClassName}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default OptionSelect;
