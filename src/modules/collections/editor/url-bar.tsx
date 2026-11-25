import type { ReactNode } from "react";
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
        <input
          aria-label="URL"
          value={url}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(event) => onUrlChange(event.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] text-foreground outline-none placeholder:text-dim"
        />
      </div>
      {action}
    </form>
  );
}

export default UrlBar;
