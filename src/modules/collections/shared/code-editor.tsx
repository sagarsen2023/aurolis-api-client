import { useCallback, type KeyboardEvent } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { GraphQLSchema } from "graphql";
import { CodeField } from "@/components/code-field";
import { Button } from "@/components/ui/button";
import type { CodeLanguage } from "@/lib/codemirror/languages";
import { cn } from "@/lib/utils";
import { formatJson } from "@/utils/json";

const ROW_HEIGHT_PX = 21;

function isFormatShortcut(event: KeyboardEvent<HTMLElement>) {
  return event.shiftKey && event.altKey && event.code === "KeyF";
}

function CodeEditor({
  value,
  onChange,
  label,
  placeholder,
  language = "text",
  className,
  minRows = 10,
  error,
  variables,
  graphqlSchema,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  language?: CodeLanguage;
  className?: string;
  minRows?: number;
  error?: string;
  variables?: readonly string[];
  graphqlSchema?: GraphQLSchema | null;
}>) {
  const canFormat = language === "json";

  const beautify = useCallback(() => {
    const formatted = formatJson(value);
    if (formatted === null) {
      toast.error("That isn't valid JSON yet.");
      return;
    }
    onChange(formatted);
  }, [value, onChange]);

  return (
    <div
      className={cn("relative flex min-h-0 flex-col gap-1", className)}
      onKeyDown={(event) => {
        if (!canFormat || !isFormatShortcut(event)) return;
        event.preventDefault();
        beautify();
      }}
    >
      {canFormat ? (
        <Button
          variant="ghost"
          size="xs"
          className="absolute top-1.5 right-2 z-10"
          title="Beautify (Shift Alt F)"
          onClick={beautify}
          disabled={!value.trim()}
        >
          <Wand2 />
          Beautify
        </Button>
      ) : null}
      <CodeField
        label={label}
        value={value}
        onChange={onChange}
        language={language}
        placeholder={placeholder}
        variables={variables}
        graphqlSchema={graphqlSchema}
        minHeight={`${minRows * ROW_HEIGHT_PX + 20}px`}
        invalid={Boolean(error)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export default CodeEditor;
