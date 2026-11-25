import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { prettyJson } from "@/utils/json";

function CodeEditor({
  value,
  onChange,
  label,
  placeholder,
  language = "text",
  className,
  minRows = 10,
  error,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  language?: "json" | "text" | "graphql";
  className?: string;
  minRows?: number;
  error?: string;
}>) {
  const beautify = () => {
    const formatted = prettyJson(value);
    if (formatted === null) {
      toast.error("That isn't valid JSON yet.");
      return;
    }
    onChange(formatted);
  };

  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      {language === "json" ? (
        <Button
          variant="ghost"
          size="xs"
          className="absolute top-2 right-2 z-10"
          onClick={beautify}
          disabled={!value.trim()}
        >
          <Wand2 />
          Beautify
        </Button>
      ) : null}
      <Textarea
        aria-label={label}
        value={value}
        rows={minRows}
        spellCheck={false}
        placeholder={placeholder}
        error={error}
        onChange={(event) => onChange(event.target.value)}
        className="field-sizing-fixed min-h-28 rounded-2xl bg-input/20 font-mono text-[12.5px] leading-relaxed"
      />
    </div>
  );
}

export default CodeEditor;
