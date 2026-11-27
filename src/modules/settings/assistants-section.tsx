import { useState } from "react";
import { useSetAtom } from "jotai";
import { BookOpen, Check, Download, FolderGit2, GitCommit } from "lucide-react";
import type { IconType } from "react-icons";
import { SiClaude, SiCursor } from "react-icons/si";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Spinner } from "@/components/ui/spinner";
import { commitDialogOpenAtom } from "@/context/workspace-context";
import { useAssistantKit } from "@/hooks/use-assistant-kit";
import { usePromise } from "@/hooks/usePromise";
import { ASSISTANT_PATHS } from "@/lib/assistant-kit";
import SetupGuide, { type AssistantId } from "./assistants/setup-guide";
import { SettingsGroup, SettingsSection } from "./section";

const ASSISTANTS: ReadonlyArray<{
  id: AssistantId;
  name: string;
  by: string | null;
  icon: IconType;
  description: string;
}> = [
  {
    id: "claude",
    name: "Claude",
    by: "Anthropic",
    icon: SiClaude,
    description:
      "Claude Code reads the workspace skill, then adds requests and saved responses from your code or from live calls, and opens a pull request.",
  },
  {
    id: "cursor",
    name: "Cursor",
    by: null,
    icon: SiCursor,
    description:
      "Cursor's agent follows the workspace rule to add requests and saved responses in the right files, locally or in a background agent on GitHub.",
  },
];

function KitActions({ compact = false }: Readonly<{ compact?: boolean }>) {
  const { workspace, kit, installed, complete, install, download } =
    useAssistantKit();
  const openCommit = useSetAtom(commitDialogOpenAtom);

  const { loading: installing, runPromise: runInstall } = usePromise({
    promise: install,
    onSuccess: (written) =>
      toast.success(
        `${written.length} assistant ${written.length === 1 ? "file" : "files"} written to the repository`,
        {
          description: "Commit and push to put them on GitHub.",
          action: { label: "Commit", onClick: () => openCommit(true) },
        },
      ),
  });
  const { loading: downloading, runPromise: runDownload } = usePromise({
    promise: download,
    onSuccess: (saved) => {
      if (saved.saved) toast.success("Kit saved", { description: saved.path });
    },
  });

  const disabled = !workspace?.isWorkspace || !kit;
  const partial = (installed?.length ?? 0) > 0 && !complete;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size={compact ? "sm" : "default"}
        variant={complete ? "outline" : "default"}
        disabled={disabled || installing}
        onClick={() => void runInstall()}
      >
        {installing ? <Spinner /> : <FolderGit2 />}
        {complete || partial ? "Update the files" : "Add to the repository"}
      </Button>
      <Button
        size={compact ? "sm" : "default"}
        variant="outline"
        disabled={disabled}
        onClick={() => openCommit(true)}
      >
        <GitCommit />
        Commit and push
      </Button>
      <Button
        size={compact ? "sm" : "default"}
        variant="ghost"
        disabled={disabled || downloading}
        onClick={() => void runDownload()}
      >
        {downloading ? <Spinner /> : <Download />}
        Download .zip
      </Button>
    </div>
  );
}

function KitCard() {
  const { workspace, installed, complete } = useAssistantKit();

  if (!workspace?.isWorkspace) {
    return (
      <SettingsGroup className="px-5 py-4">
        <p className="text-[13.5px] text-mute">
          Open a workspace to set up Claude and Cursor for it.
        </p>
      </SettingsGroup>
    );
  }

  return (
    <SettingsGroup className="flex flex-col gap-4 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[15px] text-foreground">
            Assistant kit for {workspace.entry.name}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-mute">
            A skill for Claude Code and a rule for Cursor, written into the
            workspace's git repository. They describe how Aurolis stores
            requests, examples and environments, and map this workspace's
            collections, so an assistant connected to the repository adds APIs
            and their responses where Aurolis expects them.
          </p>
        </div>
        {installed === null ? null : complete ? (
          <Pill variant="ok">
            <Check aria-hidden />
            In the repository
          </Pill>
        ) : (
          <Pill variant="outline">Not added</Pill>
        )}
      </div>
      <ul className="flex flex-col gap-1 rounded-xl border border-line bg-surface-2 px-4 py-3 font-mono text-[12px] text-mute">
        {ASSISTANT_PATHS.map((path) => (
          <li key={path} className="flex items-center gap-2">
            {installed?.includes(path) ? (
              <Check className="size-3.5 text-vio" aria-label="Written" />
            ) : (
              <span className="size-3.5" aria-hidden />
            )}
            {path}
          </li>
        ))}
      </ul>
      <p className="text-[12.5px] text-mute">
        No secret values go in these files. Run Update the files after you add
        collections or folders, so the map stays current.
      </p>
      <KitActions />
    </SettingsGroup>
  );
}

export function AssistantsSection() {
  const [guide, setGuide] = useState<AssistantId | null>(null);
  const { workspace } = useAssistantKit();

  return (
    <SettingsSection
      id="assistants"
      title="AI assistants"
      description="Connect Claude and Cursor to this workspace's GitHub repository, so they can add API requests and saved responses in the Aurolis format. Secret values never leave this device."
    >
      <div className="flex flex-col gap-3">
        <KitCard />
        {ASSISTANTS.map((assistant) => {
          const Icon = assistant.icon;
          return (
            <SettingsGroup key={assistant.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-raise text-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] text-foreground">
                      {assistant.name}
                      {assistant.by ? (
                        <span className="text-mute"> by {assistant.by}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-mute">
                      {assistant.description}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-0.5 shrink-0"
                  disabled={!workspace?.isWorkspace}
                  onClick={() => setGuide(assistant.id)}
                >
                  <BookOpen strokeWidth={1.8} />
                  Setup guide
                </Button>
              </div>
            </SettingsGroup>
          );
        })}
      </div>
      <SetupGuide
        assistant={guide}
        workspace={workspace}
        kitAction={<KitActions compact />}
        onClose={() => setGuide(null)}
      />
    </SettingsSection>
  );
}
