import { useAtom } from "jotai";
import { Link2 } from "lucide-react";
import type { IconType } from "react-icons";
import { SiClaude, SiCursor } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { connectedAssistantsAtom } from "@/context/settings-atoms";
import { SettingsGroup, SettingsSection } from "./section";

const ASSISTANTS: ReadonlyArray<{
  id: string;
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
      "Draft requests from a plain-English description, write assertions and explain responses. Connect an Anthropic API key, or let Claude Code work with your workspace over MCP.",
  },
  {
    id: "cursor",
    name: "Cursor",
    by: null,
    icon: SiCursor,
    description:
      "Give Cursor's agent access to your collections, examples and environments through the Aurolis MCP server.",
  },
];

export function AssistantsSection() {
  const [connected, setConnected] = useAtom(connectedAssistantsAtom);

  return (
    <SettingsSection
      id="assistants"
      title="AI assistants"
      description="Connect the assistants you already use. They can read collections and run requests through Aurolis; secret values never leave this device."
    >
      <div className="flex flex-col gap-3">
        {ASSISTANTS.map((assistant) => {
          const Icon = assistant.icon;
          const isConnected = connected[assistant.id] === true;
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
                  variant={isConnected ? "outline" : "default"}
                  size="sm"
                  className="mt-0.5 shrink-0"
                  onClick={() =>
                    setConnected((current) => ({
                      ...current,
                      [assistant.id]: !current[assistant.id],
                    }))
                  }
                >
                  <Link2 strokeWidth={1.8} />
                  {isConnected ? "Connected" : "Connect"}
                </Button>
              </div>
            </SettingsGroup>
          );
        })}
      </div>
      <p className="mt-3 text-[12.5px] text-dim">
        Prototype: connectors are simulated, and @aurolis/mcp is the pinned
        package name for the Aurolis MCP server.
      </p>
    </SettingsSection>
  );
}
