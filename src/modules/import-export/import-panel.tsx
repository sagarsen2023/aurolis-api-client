import { useRef, useState, type DragEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CircleCheck,
  CircleX,
  Download,
  FolderClosed,
  Globe,
  Info,
  KeyRound,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ChoiceCard } from "@/components/choice-card";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  IMPORT_HINTS,
  IMPORT_NOTE_MESSAGES,
  TRANSFER_FORMATS,
} from "@/constants/import-export";
import {
  type CredentialChoice,
  useTransferImport,
} from "@/hooks/use-transfer-import";
import { usePromise } from "@/hooks/usePromise";
import { countItems } from "@/lib/collection-ops";
import { summarizeCredentials } from "@/lib/transfer";
import { cn } from "@/lib/utils";
import type {
  CredentialSummary,
  ImportBundle,
  ImportNote,
  TransferFormat,
} from "@/types/transfer/transfer.type";
import { importHoppscotch } from "@/utils/hoppscotch";
import { importPostman } from "@/utils/postman";

type ReadState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      files: string[];
      bundle: ImportBundle;
      credentials: CredentialSummary;
    };

const READERS: Record<
  TransferFormat,
  (sources: { name: string; bytes: Uint8Array }[]) => ImportBundle
> = {
  postman: importPostman,
  hoppscotch: importHoppscotch,
};

const plural = (count: number, word: string) =>
  `${count.toLocaleString("en")} ${word}${count === 1 ? "" : "s"}`;

function collectionDetail(items: ImportBundle["collections"][number]["items"]) {
  const { folders, requests, examples } = countItems(items);
  return [
    "Collection",
    plural(folders, "folder"),
    plural(requests, "request"),
    ...(examples > 0 ? [plural(examples, "example")] : []),
  ].join(" · ");
}

function DropZone({
  format,
  onFiles,
}: Readonly<{ format: TransferFormat; onFiles: (files: File[]) => void }>) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    onFiles([...event.dataTransfer.files]);
  };
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={cn(
          "h-auto min-h-38 w-full flex-col gap-1.5 rounded-2xl border-[1.5px] border-dashed border-line-strong bg-surface-2 px-6 py-6 text-center font-normal whitespace-normal text-mute hover:border-vio hover:bg-vio/5",
          over && "border-vio bg-vio/5",
        )}
      >
        <Upload
          className="mb-1 size-7 text-vio"
          strokeWidth={1.8}
          aria-hidden
        />
        <span className="text-[14.5px] font-semibold text-foreground">
          Drop files here or click to browse
        </span>
        <span className="text-[13px]">{IMPORT_HINTS[format].files}</span>
      </Button>
      <Input
        ref={input}
        type="file"
        multiple
        accept={IMPORT_HINTS[format].accept}
        aria-label="Files to import"
        className="hidden"
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
    </>
  );
}

function FoundRow({
  icon: Icon,
  name,
  detail,
}: Readonly<{ icon: typeof Globe; name: string; detail: string }>) {
  return (
    <li className="flex items-center gap-3 border-t border-line px-4 py-2.5">
      <Icon className="size-4 shrink-0 text-vio" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">
        {name}
      </span>
      <span className="shrink-0 text-[12.5px] text-dim">{detail}</span>
    </li>
  );
}

function CredentialChoices({
  summary,
  choice,
  onChange,
}: Readonly<{
  summary: CredentialSummary;
  choice: CredentialChoice;
  onChange: (choice: CredentialChoice) => void;
}>) {
  const found = [
    ...(summary.tokens > 0 ? [plural(summary.tokens, "token")] : []),
    ...(summary.headers > 0 ? [plural(summary.headers, "API key header")] : []),
  ].join(" and ");
  const variables = summary.variables.map((name) => `{{${name}}}`).join(", ");
  return (
    <section
      aria-labelledby="import-credentials"
      className="flex flex-col gap-2.5 border-t border-line px-4 py-3.5"
    >
      <p
        id="import-credentials"
        className="flex items-start gap-2 text-[13px] text-foreground"
      >
        <KeyRound
          className="mt-0.5 size-3.5 shrink-0 text-warning"
          aria-hidden
        />
        <span>
          These files hold {found} as plain text. Kept as they are, they're
          saved in the request files and committed with the workspace.
        </span>
      </p>
      <div
        role="radiogroup"
        aria-labelledby="import-credentials"
        className="flex flex-col gap-2"
      >
        <ChoiceCard
          selected={choice === "replace"}
          onSelect={() => onChange("replace")}
          icon={ShieldCheck}
          title="Replace with variables"
          description={`Requests and saved responses use ${variables} instead. Set the values once as secret globals; they stay on this computer.`}
        />
        <ChoiceCard
          selected={choice === "keep"}
          onSelect={() => onChange("keep")}
          icon={KeyRound}
          title="Keep them in the requests"
          description="Use this only if the values are safe to share with everyone who can see the repository."
        />
      </div>
    </section>
  );
}

function ImportPanel() {
  const [format, setFormat] = useState<TransferFormat>("postman");
  const [state, setState] = useState<ReadState>({ status: "idle" });
  const [credentials, setCredentials] = useState<CredentialChoice>("replace");
  const navigate = useNavigate();
  const { runImport, progress } = useTransferImport();
  const { loading, runPromise } = usePromise({
    promise: () =>
      state.status === "ready"
        ? runImport(state.bundle, credentials)
        : Promise.resolve(null),
    onSuccess: (result) => {
      if (!result) return;
      setState({ status: "idle" });
      toast.success(`Imported ${plural(result.collections, "collection")}`, {
        description:
          result.secretNames.length > 0
            ? `Set ${result.secretNames.map((name) => `{{${name}}}`).join(", ")} in Environments › Globals.`
            : undefined,
        action: {
          label: "Open",
          onClick: () => void navigate({ to: "/collections" }),
        },
      });
    },
  });

  const readFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setState({ status: "reading" });
    try {
      const sources = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
        })),
      );
      const bundle = READERS[format](sources);
      setState({
        status: "ready",
        files: files.map((file) => file.name),
        bundle,
        credentials: summarizeCredentials(bundle),
      });
      setCredentials("replace");
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "These files can't be read.",
      });
    }
  };

  const changeFormat = (next: TransferFormat) => {
    setFormat(next);
    setState({ status: "idle" });
  };

  return (
    <Card displayGradient aria-label="Import" className="gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-foreground">Import</h2>
        <SegmentedControl
          label="Import from"
          value={format}
          options={TRANSFER_FORMATS}
          onChange={changeFormat}
        />
      </div>
      <DropZone format={format} onFiles={(files) => void readFiles(files)} />
      {state.status === "reading" ? (
        <p
          role="status"
          className="flex items-center gap-2 text-[13px] text-mute"
        >
          <Spinner /> Reading files…
        </p>
      ) : null}
      {state.status === "error" ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-surface-2 px-4 py-3.5"
        >
          <CircleX className="size-5 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-foreground">
              Can't import this
            </p>
            <p className="text-[13px] text-mute">{state.message}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setState({ status: "idle" })}
          >
            Clear
          </Button>
        </div>
      ) : null}
      {state.status === "ready" ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-foreground">
                {state.files.join(", ")}
              </p>
              <p className="text-[13px] text-mute" role="status">
                {progress
                  ? `Importing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
                  : `Ready to import ${[
                      plural(state.bundle.collections.length, "collection"),
                      ...(state.bundle.environments.length > 0
                        ? [
                            plural(
                              state.bundle.environments.length,
                              "environment",
                            ),
                          ]
                        : []),
                    ].join(" and ")}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => setState({ status: "idle" })}
            >
              Clear
            </Button>
            <Button
              size="sm"
              className="hover:bg-lav-hover"
              disabled={loading}
              onClick={() => void runPromise()}
            >
              {loading ? <Spinner /> : <Download />}
              Import
            </Button>
          </div>
          <ul aria-label="What will be imported">
            {state.bundle.collections.map((collection) => (
              <FoundRow
                key={collection.id}
                icon={FolderClosed}
                name={collection.name}
                detail={collectionDetail(collection.items)}
              />
            ))}
            {state.bundle.environments.map((environment, index) => (
              <FoundRow
                key={`${environment.name}-${index}`}
                icon={Globe}
                name={environment.name}
                detail={`Environment · ${plural(environment.variables.length, "variable")}`}
              />
            ))}
          </ul>
          {state.credentials.tokens + state.credentials.headers > 0 ? (
            <CredentialChoices
              summary={state.credentials}
              choice={credentials}
              onChange={setCredentials}
            />
          ) : null}
          {Object.keys(state.bundle.notes).length > 0 ? (
            <ul
              aria-label="Import notes"
              className="flex flex-col gap-1.5 border-t border-line px-4 py-3"
            >
              {Object.entries(state.bundle.notes).map(([note, count]) => (
                <li
                  key={note}
                  className="flex items-start gap-2 text-[12.5px] text-mute"
                >
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {IMPORT_NOTE_MESSAGES[note as ImportNote](count)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export default ImportPanel;
