import { Link2 } from "lucide-react";
import type { IconType } from "react-icons";
import { SiClaude, SiCursor } from "react-icons/si";
import { Button } from "@/components/ui/button";
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
  return (
    <SettingsSection
      id="assistants"
      title="AI assistants"
      description="Soon you can connect the assistants you already use, so they can read collections and run requests through Aurolis. Secret values never leave this device."
    >
      <div className="flex flex-col gap-3">
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
                  disabled
                >
                  <Link2 strokeWidth={1.8} />
                  Coming soon
                </Button>
              </div>
            </SettingsGroup>
          );
        })}
      </div>
    </SettingsSection>
  );
}
