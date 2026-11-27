import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function CopyBlock({
  text,
  label,
  prose = false,
}: Readonly<{ text: string; label: string; prose?: boolean }>) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="group relative rounded-xl border border-line bg-surface-2">
      <pre
        className={cn(
          "overflow-x-auto px-4 py-3 pr-12 text-[12.5px] leading-relaxed text-foreground",
          prose ? "font-sans whitespace-pre-wrap" : "font-mono",
        )}
      >
        {text}
      </pre>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={copied ? "Copied" : label}
        className="absolute top-2 right-2"
        onClick={copy}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

export default CopyBlock;
