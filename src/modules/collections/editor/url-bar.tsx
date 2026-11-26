import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function UrlBar({
  leading,
  url,
  onUrlChange,
  placeholder,
  action,
  onSubmit,
}: Readonly<{
  leading?: ReactNode;
  url: string;
  onUrlChange: (url: string) => void;
  placeholder: string;
  action: ReactNode;
  onSubmit: () => void;
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
        <div className="min-w-0 flex-1">
          <Input
            aria-label="URL"
            value={url}
            placeholder={placeholder}
            spellCheck={false}
            onChange={(event) => onUrlChange(event.target.value)}
            className="h-8 border-0 bg-transparent px-3 font-mono text-[13px] shadow-none focus-visible:ring-0"
          />
        </div>
      </div>
      {action}
    </form>
  );
}

export default UrlBar;
