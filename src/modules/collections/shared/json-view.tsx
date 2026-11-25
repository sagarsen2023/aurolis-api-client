import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { tokenizeJson, type JsonTokenKind } from "@/lib/json-tokens";

const TOKEN_CLASS: Record<JsonTokenKind, string> = {
  key: "text-json-key",
  string: "text-json-string",
  number: "text-json-number",
  boolean: "text-json-boolean",
  null: "text-json-null",
  plain: "",
};

function JsonView({
  text,
  className,
}: Readonly<{ text: string; className?: string }>) {
  const tokens = useMemo(() => tokenizeJson(text), [text]);
  return (
    <pre
      className={cn(
        "font-mono text-[12.5px] leading-relaxed break-all whitespace-pre-wrap text-code",
        className,
      )}
    >
      {tokens.map((token, index) =>
        token.kind === "plain" ? (
          token.text
        ) : (
          <span key={index} className={TOKEN_CLASS[token.kind]}>
            {token.text}
          </span>
        ),
      )}
    </pre>
  );
}

export default JsonView;
