import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CURSOR_RULE_PATH, SKILL_DIR } from "@/lib/assistant-kit";
import type { OpenedWorkspace } from "@/types/workspace/workspace-store.type";
import CopyBlock from "./copy-block";

export type AssistantId = "claude" | "cursor";

function repoUrl(workspace: OpenedWorkspace) {
  const url = workspace.git.remoteUrl ?? workspace.entry.remote?.url ?? null;
  if (!url) return null;
  const ssh = /^git@github\.com:(.+?)(\.git)?$/.exec(url);
  return ssh ? `https://github.com/${ssh[1]}` : url.replace(/\.git$/, "");
}

function repoFolder(url: string) {
  return url.split("/").pop() ?? "workspace";
}

const PROMPTS = [
  "Read the API routes in this codebase and add every endpoint that's missing from the Aurolis workspace, each with a 200 example. Open a pull request.",
  "Add POST /orders to the Orders folder in Aurolis. Send it to the staging base URL and save the 201 response as an example.",
  "The products endpoints changed. Update their Aurolis examples to match the current response shape.",
];

function Step({
  number,
  title,
  children,
}: Readonly<{ number: number; title: string; children: ReactNode }>) {
  return (
    <li className="flex gap-4">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-lav text-[13px] font-semibold text-lav-ink">
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 pb-2">
        <h3 className="text-[15px] font-medium text-foreground">{title}</h3>
        <div className="flex flex-col gap-2.5 text-[13.5px] leading-relaxed text-mute">
          {children}
        </div>
      </div>
    </li>
  );
}

function Code({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[12.5px] text-foreground">
      {children}
    </code>
  );
}

function ClaudeSteps({
  workspace,
  url,
  kitAction,
}: Readonly<{
  workspace: OpenedWorkspace;
  url: string | null;
  kitAction: ReactNode;
}>) {
  return (
    <ol className="flex flex-col gap-5">
      <Step number={1} title="Put the skill in the workspace repository">
        <p>
          Aurolis writes a Claude Code skill to <Code>{SKILL_DIR}/</Code>. It
          explains the workspace's file format and lists its collections,
          folders and environments.
        </p>
        {kitAction}
        <p>
          Then commit and push, so the skill is on GitHub with the workspace.
        </p>
      </Step>
      <Step number={2} title="Start Claude Code on the repository">
        <p>In a terminal, on this computer:</p>
        <CopyBlock
          label="Copy the commands"
          text={`cd "${workspace.entry.repoDir}"\nclaude`}
        />
        {url ? (
          <>
            <p>Or anywhere else, from GitHub:</p>
            <CopyBlock
              label="Copy the commands"
              text={`git clone ${url}.git\ncd ${repoFolder(url)}\nclaude`}
            />
            <p>
              Claude Code on the web and in the Claude app works too: start a
              session on <Code>{url.replace("https://github.com/", "")}</Code>.
              Claude finds the skill in the repository by itself.
            </p>
          </>
        ) : (
          <p>
            Publish the workspace to GitHub to use it from Claude Code on the
            web or on other computers.
          </p>
        )}
      </Step>
      <Step number={3} title="Ask for requests and responses">
        <p>Claude adds files in the workspace format, commits and pushes:</p>
        {PROMPTS.map((prompt) => (
          <CopyBlock key={prompt} prose label="Copy the prompt" text={prompt} />
        ))}
        <p>
          Pull in Aurolis (it pulls when you open the workspace) to see the new
          requests.
        </p>
      </Step>
      <Step number={4} title="Working from your code repository instead">
        <p>
          To document an API from its source code, download the kit and copy{" "}
          <Code>.claude/</Code> to the root of the code repository. The skill
          tells Claude to clone the workspace repository next to it and open a
          pull request there.
        </p>
        {url ? (
          <>
            <p>
              Optional: let Claude edit the workspace repository on GitHub
              without cloning it, through GitHub's MCP server. Use a
              fine-grained token with Contents and Pull requests access to that
              repository only.
            </p>
            <CopyBlock
              label="Copy the command"
              text={`claude mcp add --transport http github https://api.githubcopilot.com/mcp/ -H "Authorization: Bearer YOUR_GITHUB_TOKEN"`}
            />
          </>
        ) : null}
      </Step>
    </ol>
  );
}

function CursorSteps({
  workspace,
  url,
  kitAction,
}: Readonly<{
  workspace: OpenedWorkspace;
  url: string | null;
  kitAction: ReactNode;
}>) {
  return (
    <ol className="flex flex-col gap-5">
      <Step number={1} title="Put the rule in the workspace repository">
        <p>
          Aurolis writes a Cursor project rule to{" "}
          <Code>{CURSOR_RULE_PATH}</Code> with the workspace's file format and
          its collections, folders and environments.
        </p>
        {kitAction}
        <p>
          Then commit and push, so the rule is on GitHub with the workspace.
        </p>
      </Step>
      <Step number={2} title="Open the repository in Cursor">
        <p>On this computer, open this folder in Cursor:</p>
        <CopyBlock label="Copy the path" text={workspace.entry.repoDir} />
        {url ? (
          <p>
            Or clone <Code>{url}</Code> anywhere. Cursor's background agents
            work on the GitHub repository and read the same rule.
          </p>
        ) : null}
        <p>
          The agent uses the rule when it works on <Code>collections/</Code> or{" "}
          <Code>environments/</Code>, or when you mention{" "}
          <Code>@aurolis-workspace</Code> in the chat.
        </p>
      </Step>
      <Step number={3} title="Ask the agent">
        {PROMPTS.map((prompt) => (
          <CopyBlock key={prompt} prose label="Copy the prompt" text={prompt} />
        ))}
        <p>
          Pull in Aurolis (it pulls when you open the workspace) to see the new
          requests.
        </p>
      </Step>
      <Step number={4} title="Working from your code repository instead">
        <p>
          Download the kit and copy <Code>.cursor/</Code> to the root of the
          code repository. The rule tells the agent to clone the workspace
          repository and open a pull request there. To skip cloning, add
          GitHub's MCP server in Cursor's MCP settings.
        </p>
      </Step>
    </ol>
  );
}

function SetupGuide({
  assistant,
  workspace,
  kitAction,
  onClose,
}: Readonly<{
  assistant: AssistantId | null;
  workspace: OpenedWorkspace | null;
  kitAction: ReactNode;
  onClose: () => void;
}>) {
  const url = workspace ? repoUrl(workspace) : null;
  const name = assistant === "cursor" ? "Cursor" : "Claude";

  return (
    <Sheet
      open={assistant !== null && workspace !== null}
      onOpenChange={(open) => (open ? null : onClose())}
    >
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-xl font-medium">Set up {name}</SheetTitle>
          <SheetDescription>
            {name} adds requests and saved responses to{" "}
            {workspace?.entry.name ?? "this workspace"} by editing its files in
            git, the same way Aurolis does.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-8">
          {workspace && assistant === "claude" ? (
            <ClaudeSteps
              workspace={workspace}
              url={url}
              kitAction={kitAction}
            />
          ) : null}
          {workspace && assistant === "cursor" ? (
            <CursorSteps
              workspace={workspace}
              url={url}
              kitAction={kitAction}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default SetupGuide;
