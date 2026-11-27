import { useMemo, useState } from "react";
import { useSetAtom } from "jotai";
import { toast } from "sonner";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { METHOD_TEXT_CLASS } from "@/constants/request";
import { expandedNodesAtom } from "@/context/collections-context";
import { useCollectionActions } from "@/hooks/use-collection-actions";
import { useEditorTabs } from "@/hooks/use-editor-tabs";
import { usePromise } from "@/hooks/usePromise";
import { CurlParseError, curlRequestName, parseCurl } from "@/lib/curl";
import { cn } from "@/lib/utils";
import type { CurlImport } from "@/types/transfer/curl.type";
import { MAX_NAME_LENGTH } from "@/utils/name";

const BODY_LABELS: Record<CurlImport["body"]["mode"], string | null> = {
  none: null,
  json: "JSON body",
  text: "text body",
  xml: "XML body",
  urlencoded: "form URL-encoded body",
  "form-data": "multipart form body",
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

function summary(curl: CurlImport) {
  return [
    curl.params.length > 0 ? plural(curl.params.length, "query param") : null,
    curl.headers.length > 0 ? plural(curl.headers.length, "header") : null,
    BODY_LABELS[curl.body.mode],
    curl.auth
      ? `${curl.auth.type === "basic" ? "basic" : "bearer"} auth`
      : null,
  ].filter(Boolean);
}

function readCurl(text: string) {
  if (!text.trim()) return { curl: null, error: null };
  try {
    return { curl: parseCurl(text), error: null };
  } catch (error) {
    return {
      curl: null,
      error:
        error instanceof CurlParseError
          ? error.message
          : "Couldn't read this command.",
    };
  }
}

function ImportCurlDialog({
  parentId,
  parentName,
  onClose,
}: Readonly<{ parentId: string; parentName: string; onClose: () => void }>) {
  const [command, setCommand] = useState("");
  const [name, setName] = useState("");
  const { curl, error } = useMemo(() => readCurl(command), [command]);
  const setExpanded = useSetAtom(expandedNodesAtom);
  const { openTab } = useEditorTabs();
  const { apply } = useCollectionActions();
  const finalName = name.trim() || (curl ? curlRequestName(curl) : "");

  const { loading, runPromise } = usePromise({
    promise: () =>
      apply({
        op: "create-request",
        parentId,
        name: finalName,
        protocol: "http",
        curl: curl ?? undefined,
      }),
    onSuccess: (id) => {
      toast.success("Request imported from cURL");
      setExpanded((current) => ({ ...current, [parentId]: true }));
      if (id) openTab({ kind: "request", id });
      onClose();
    },
  });

  const details = curl ? summary(curl) : [];

  return (
    <FormDialog
      wide
      title="Import cURL"
      description={`Paste a curl command to add it as a request inside ${parentName}.`}
      submitLabel="Import request"
      busy={loading}
      canSubmit={Boolean(curl) && finalName.length > 0}
      onClose={onClose}
      onSubmit={() => void runPromise()}
    >
      <div className="flex flex-col gap-4">
        <Textarea
          id="curl-command"
          label="curl command"
          autoFocus
          spellCheck={false}
          value={command}
          placeholder={
            "curl https://api.example.com/v1/payments \\\n  -H 'Authorization: Bearer …' \\\n  --json '{\"amount\": 100}'"
          }
          error={error ?? undefined}
          onChange={(event) => setCommand(event.target.value)}
          className="max-h-64 min-h-32 overflow-auto font-mono text-[12.5px] leading-relaxed"
        />
        {curl ? (
          <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
            <p className="flex min-w-0 items-center gap-2 font-mono text-[12.5px]">
              <span
                className={cn("font-semibold", METHOD_TEXT_CLASS[curl.method])}
              >
                {curl.method}
              </span>
              <span className="truncate text-foreground">{curl.url}</span>
            </p>
            {details.length > 0 ? (
              <p className="mt-1 text-[12.5px] text-mute">
                {details.join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
        <Input
          id="curl-request-name"
          label="Name"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder={curl ? curlRequestName(curl) : "Create payment"}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
    </FormDialog>
  );
}

export default ImportCurlDialog;
