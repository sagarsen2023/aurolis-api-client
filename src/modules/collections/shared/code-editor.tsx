import type { VariableInfo } from "@/types/workspace/variable.type";
import { useCallback, type KeyboardEvent, type ReactNode } from "react";
import { FileCode2, Wand2 } from "lucide-react";
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
  onShowTypescript,
  toolbarStart,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  language?: CodeLanguage;
  className?: string;
  minRows?: number;
  error?: string;
  variables?: readonly VariableInfo[];
  graphqlSchema?: GraphQLSchema | null;
  onShowTypescript?: () => void;
  toolbarStart?: ReactNode;
}>) {
  const isJson = language === "json";
  const minHeight = `${minRows * ROW_HEIGHT_PX + 20}px`;

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
      className={cn("flex min-h-0 flex-col gap-1.5", className)}
      onKeyDown={(event) => {
        if (!isJson || !isFormatShortcut(event)) return;
        event.preventDefault();
        beautify();
      }}
    >
      {isJson || toolbarStart ? (
        <div className="flex items-center gap-1">
          <div className="mr-auto">{toolbarStart}</div>
          {isJson && onShowTypescript ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={onShowTypescript}
              disabled={!value.trim()}
            >
              <FileCode2 />
              TypeScript
            </Button>
          ) : null}
          {isJson ? (
            <Button
              variant="ghost"
              size="xs"
              title="Beautify (Shift Alt F)"
              onClick={beautify}
              disabled={!value.trim()}
            >
              <Wand2 />
              Beautify
            </Button>
          ) : null}
        </div>
      ) : null}
      <CodeField
        label={label}
        value={value}
        onChange={onChange}
        language={language}
        placeholder={placeholder}
        variables={variables}
        graphqlSchema={graphqlSchema}
        minHeight={minHeight}
        invalid={Boolean(error)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export default CodeEditor;
