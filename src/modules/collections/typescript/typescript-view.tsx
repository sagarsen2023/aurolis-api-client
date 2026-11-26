import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { CodeField } from "@/components/code-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  generateTypescriptInterface,
  toTypeName,
} from "@/utils/generate-typescript-interface";
import { parseJsonWithVariables } from "@/utils/json";

const NAME_PATTERN = /^[A-Za-z_$][\w$]*$/;

function TypescriptView({
  json,
  rootName,
  label,
  height,
  minHeight,
  className,
}: Readonly<{
  json: string;
  rootName: string;
  label: string;
  height?: string;
  minHeight?: string;
  className?: string;
}>) {
  const [name, setName] = useState(rootName);
  const validName = NAME_PATTERN.test(name) ? name : toTypeName(name);
  const generated = useMemo(() => {
    const parsed = parseJsonWithVariables(json);
    if (!parsed.ok) return null;
    return generateTypescriptInterface(parsed.value, validName);
  }, [json, validName]);

  const copy = () => {
    if (!generated) return;
    void navigator.clipboard.writeText(generated);
    toast.success("TypeScript copied");
  };

  return (
    <div className={className ?? "flex min-h-0 flex-col gap-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          label="Root type"
          value={name}
          spellCheck={false}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          className="h-7 w-56 font-mono text-[12px]"
        />
        <Button
          size="xs"
          variant="outline"
          className="ml-auto"
          disabled={!generated}
          onClick={copy}
        >
          <Copy />
          Copy TypeScript
        </Button>
      </div>
      {generated ? (
        <div className={height ? "relative min-h-0 flex-1" : undefined}>
          <div className={height ? "absolute inset-0" : undefined}>
            <CodeField
              readOnly
              label={label}
              language="typescript"
              value={generated}
              height={height}
              minHeight={minHeight}
              className={height ? "h-full" : undefined}
            />
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-line px-4 py-6 text-center text-[13px] text-mute">
          {json.trim()
            ? "This isn't valid JSON yet, so there's nothing to type. Fix it in the JSON view."
            : "Add a JSON body first. Its TypeScript interface appears here."}
        </p>
      )}
    </div>
  );
}

export default TypescriptView;
