import type { ReactNode } from "react";
import { VariableInput } from "@/components/variable-input";
import { cn } from "@/lib/utils";

function UrlBar({
  leading,
  url,
  onUrlChange,
  placeholder,
  action,
  onSubmit,
  onPasteText,
}: Readonly<{
  leading?: ReactNode;
  url: string;
  onUrlChange: (url: string) => void;
  placeholder: string;
  action: ReactNode;
  onSubmit: () => void;
  onPasteText?: (text: string) => boolean;
}>) {
  return (
    <form
      className="flex items-center gap-2 px-5 pt-4 pb-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div
        className={cn(
          "flex h-10 min-w-0 flex-1 items-center rounded-full border border-input bg-input/30 pr-1 transition-shadow",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40",
        )}
      >
        {leading}
        <VariableInput
          ariaLabel="URL"
          value={url}
          placeholder={placeholder}
          onChange={onUrlChange}
          onSubmit={onSubmit}
          onPasteText={onPasteText}
          className="h-8 flex-1 px-3 text-[13px] leading-8"
        />
      </div>
      {action}
    </form>
  );
}

export default UrlBar;
