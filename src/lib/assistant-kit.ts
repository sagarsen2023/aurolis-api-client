import type { Collection, Folder } from "../types/workspace/collection.type.ts";
import type { WorkspaceData } from "../types/workspace/workspace.type.ts";
import {
  COLLECTIONS_DIR,
  ENVIRONMENTS_DIR,
  MANIFEST_PATH,
  toFilesWithPaths,
} from "./workspace-format.ts";

export const SKILL_NAME = "aurolis-workspace";
export const SKILL_DIR = `.claude/skills/${SKILL_NAME}`;
export const SKILL_PATH = `${SKILL_DIR}/SKILL.md`;
export const REFERENCE_PATH = `${SKILL_DIR}/reference.md`;
export const MAP_PATH = `${SKILL_DIR}/workspace-map.md`;
export const CURSOR_RULE_PATH = `.cursor/rules/${SKILL_NAME}.mdc`;
export const ASSISTANT_PATHS = [
  SKILL_PATH,
  REFERENCE_PATH,
  MAP_PATH,
  CURSOR_RULE_PATH,
] as const;

export type AssistantPath = (typeof ASSISTANT_PATHS)[number];

export interface AssistantKitInput {
  workspace: WorkspaceData;
  root: string;
  remoteUrl: string | null;
  branch: string | null;
}

const prefix = (root: string, path: string) =>
  root ? `${root}/${path}` : path;

function repoLink(url: string | null) {
  if (!url) return null;
  const ssh = /^git@github\.com:(.+?)(\.git)?$/.exec(url);
  if (ssh) return `https://github.com/${ssh[1]}`;
  return url.replace(/\.git$/, "");
}

function where(input: AssistantKitInput) {
  const link = repoLink(input.remoteUrl);
  const lines = [
    `- Workspace: **${input.workspace.manifest.workspace.name}**`,
    `- Workspace root in its repository: \`${input.root || "."}\` (the folder that holds \`${MANIFEST_PATH}\`)`,
  ];
  if (link) lines.push(`- Repository: ${link}`);
  if (input.branch)
    lines.push(`- Default branch when this was generated: \`${input.branch}\``);
  return lines.join("\n");
}

function skill(input: AssistantKitInput) {
  const link = repoLink(input.remoteUrl);
  const name = input.workspace.manifest.workspace.name;
  return `---
name: ${SKILL_NAME}
description: Add, update and document API requests and their saved responses in the "${name}" Aurolis workspace, a git repository of JSON files. Use when asked to add an endpoint or API to Aurolis, save a response or example, document an API from source code, sync routes into the API collection, or edit collections, folders, requests, examples or environments.
---

# Aurolis workspace: ${name}

Aurolis is a local-first API client. Its workspace is plain JSON files in a git repository, so you work with it by editing files and committing them. Aurolis picks up the changes when the user pulls or reopens the workspace.

${where(input)}

## Find the workspace

1. If \`${prefix(input.root, MANIFEST_PATH)}\` exists in the current project, work there.
2. Otherwise the workspace lives in another repository.${
    link
      ? ` Clone ${link} next to the current project (\`git clone ${link}.git\`), or, if you can't clone, use the GitHub MCP server to read and write its files.`
      : " Ask the user where it is."
  }
3. Read \`${prefix(input.root, MANIFEST_PATH)}\` and list \`${prefix(input.root, COLLECTIONS_DIR)}/\` and \`${prefix(input.root, ENVIRONMENTS_DIR)}/\` before you change anything. [workspace-map.md](workspace-map.md) is a snapshot from when this skill was generated; the files are the truth.

## Add an API request

1. Pick the collection and folder. Reuse an existing folder when one fits (for example the folder named after the resource or service); create a folder only for a new group.
2. Create \`<request-slug>.req.json\` in that folder. The slug is the request name in lowercase with every run of other characters replaced by \`-\` (\`Get product by id\` → \`get-product-by-id.req.json\`).
3. Fill it in as [reference.md](reference.md#request-files) shows. Use a fresh UUID v4 for \`id\`, and a \`seq\` 1000 above the largest \`seq\` among the items next to it.
4. Use variables for anything that changes per environment: \`{{baseUrl}}/products/{{productId}}\`, never a hard-coded host. Reuse variable names that already exist in the environments and the collection.
5. Leave \`auth\` as \`{ "type": "inherit" }\` unless the endpoint needs different auth from its folder or collection.

## Save a response (an example)

1. Put it in \`<request-slug>.examples/<example-slug>.json\` next to the request file, as [reference.md](reference.md#example-files) shows.
2. Use a real response when you can get one: send the request with \`curl\` against a non-production environment the user names, or take it from tests, fixtures or an OpenAPI spec in the code. Otherwise write a realistic one from the code that builds the response, and say so in the example's name (for example \`200 · from code\`).
3. Name examples after the status and the case: \`200 · first page\`, \`404 · unknown id\`, \`422 · missing title\`.
4. \`body\` is a string. Pretty-print JSON bodies with 2 spaces inside that string.
5. Remove secrets, tokens, cookies, emails and other personal data from bodies and headers before saving.

## Rules

- Every file is JSON with 2-space indentation, keys sorted alphabetically at every level, and a final newline. Keep that layout so diffs stay small.
- \`id\`s are unique across the whole workspace and use only letters, numbers, \`-\` and \`_\`. Never change an existing \`id\`.
- Never put secret values in files. Secret environment variables have \`"secret": true\` and \`"value": ""\`; their values stay on the user's computer.
- Don't delete or rename existing requests or examples unless the user asks. To rename, change \`name\` and rename the file to the new slug, keeping the \`id\`.
- Don't create files outside \`${prefix(input.root, MANIFEST_PATH)}\`, \`${prefix(input.root, COLLECTIONS_DIR)}/\` and \`${prefix(input.root, ENVIRONMENTS_DIR)}/\` for workspace data.
- WebSocket and Socket.IO requests save messages in the request file, not examples.

## Finish

1. Check every file you wrote parses as JSON and that new \`id\`s are unique (search the workspace for each one).
2. Commit with a message that names what you added, such as \`Add product endpoints with examples\`.
3. Push to a new branch and open a pull request${link ? ` on ${link}` : ""}, unless the user asked you to push to \`${input.branch ?? "the default branch"}\`.
4. Tell the user which requests and examples you added. They see them in Aurolis after pulling (Aurolis pulls when it opens the workspace).
`;
}

const REQUEST_EXAMPLE = {
  auth: { type: "inherit" },
  body: {
    mode: "json",
    raw: '{\n  "title": "Tote bag",\n  "price": 24\n}',
  },
  description: "Creates a product. Returns the new product with its id.",
  headers: [{ enabled: true, key: "Content-Type", value: "application/json" }],
  id: "6f1c2b9e-4a57-4c1e-9a43-0d8f2b7c5e11",
  method: "POST",
  name: "Create product",
  params: [],
  protocol: "http",
  seq: 3000,
  url: "{{baseUrl}}/products",
};

const EXAMPLE_EXAMPLE = {
  body: '{\n  "id": 195,\n  "title": "Tote bag",\n  "price": 24\n}',
  headers: [{ enabled: true, key: "content-type", value: "application/json" }],
  id: "b2a4d1f0-9c3e-4f6a-8d27-5e1b0c9a7f42",
  name: "201 · created",
  seq: 1000,
  status: 201,
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

function reference(input: AssistantKitInput) {
  const root = input.root ? `${input.root}/` : "";
  return `# Aurolis workspace format (version ${input.workspace.manifest.format})

Paths are relative to the repository root.

## Layout

\`\`\`text
${root}${MANIFEST_PATH}                         workspace name, description, default environment
${root}${COLLECTIONS_DIR}/<collection>/_collection.json
${root}${COLLECTIONS_DIR}/<collection>/<folder>/_folder.json
${root}${COLLECTIONS_DIR}/<collection>/<folder>/<request>.req.json
${root}${COLLECTIONS_DIR}/<collection>/<folder>/<request>.examples/<example>.json
${root}${ENVIRONMENTS_DIR}/<environment>.env.json
${root}${ENVIRONMENTS_DIR}/_globals.env.json      optional; variables shared by every environment
\`\`\`

Folders nest to any depth. Requests can also sit directly in a collection folder. Names in paths are slugs: lowercase ASCII, every run of other characters becomes \`-\`, at most 60 characters, and \`-2\`, \`-3\`… when two siblings would get the same slug. Order comes from \`seq\` (smaller first), not from file names.

Shared field types:

- \`KeyValue\`: \`{ "enabled": true, "key": "Accept", "value": "application/json" }\`
- \`Auth\`, one of:
  - \`{ "type": "inherit" }\`: use the folder's or collection's auth (the default for requests and folders)
  - \`{ "type": "none" }\`
  - \`{ "token": "{{token}}", "type": "bearer" }\`
  - \`{ "password": "{{password}}", "type": "basic", "username": "{{username}}" }\`
  - \`{ "in": "header", "key": "X-API-Key", "type": "apikey", "value": "{{apiKey}}" }\` (\`in\` is \`header\` or \`query\`)
- Variables are written \`{{name}}\` in URLs, params, headers, bodies and auth. Aurolis resolves them from the active environment, then the collection's \`variables\`, then globals.

## aurolis.json

\`\`\`json
${json({
  defaultEnvironment: input.workspace.manifest.defaultEnvironment,
  description: "What this workspace is for, in markdown.",
  format: input.workspace.manifest.format,
  workspace: input.workspace.manifest.workspace,
})}
\`\`\`

Change only \`description\` and \`defaultEnvironment\` (an environment \`id\` or \`null\`).

## Collection files

\`_collection.json\`: \`id\`, \`name\`, \`seq\`, \`description\` (markdown), \`auth\` (not \`inherit\`), \`variables\` (\`KeyValue[]\`; committed, so no secrets).

## Folder files

\`_folder.json\`: \`id\`, \`name\`, \`seq\`, \`description\`, \`auth\`.

## Request files

\`<request>.req.json\` has the common fields \`id\`, \`name\`, \`seq\`, \`description\` (markdown), \`protocol\`, \`url\`, \`params\` (query parameters, \`KeyValue[]\`), \`headers\` (\`KeyValue[]\`) and \`auth\`, then by protocol:

| protocol | extra fields |
| --- | --- |
| \`http\` | \`method\`: \`GET\`, \`POST\`, \`PUT\`, \`PATCH\`, \`DELETE\`, \`HEAD\` or \`OPTIONS\`; \`body\` |
| \`graphql\` | \`graphql\`: \`{ "operationName": "", "query": "query { … }", "variables": "{ … }" }\` (\`variables\` is a JSON string) |
| \`websocket\` | \`messages\`: saved messages \`{ "body", "event": "", "format": "json" or "text", "id", "name" }\` |
| \`socketio\` | \`messages\` (with \`event\` names), \`socketio\`: \`{ "events": ["event names to listen to"], "path": "/socket.io" }\` |

\`body\` for \`http\`, one of:

- \`{ "mode": "none" }\`
- \`{ "mode": "json", "raw": "…" }\` (\`raw\` may contain \`// comments\`, stripped before sending), also \`"text"\` and \`"xml"\`
- \`{ "fields": [KeyValue…], "mode": "urlencoded" }\`, also \`"form-data"\` (text fields only)

Put query parameters in \`params\`, not in \`url\`. Content-Type is added from the body mode when no header sets it.

A complete \`http\` request:

\`\`\`json
${json(REQUEST_EXAMPLE)}
\`\`\`

## Example files

Saved responses for a request, in \`<request>.examples/\` next to \`<request>.req.json\` (same slug). Fields: \`id\`, \`name\`, \`seq\`, \`status\` (100–599), \`headers\` (\`KeyValue[]\`), \`body\` (the response body as a string).

\`\`\`json
${json(EXAMPLE_EXAMPLE)}
\`\`\`

## Environment files

\`<environment>.env.json\`: \`id\`, \`name\`, \`seq\`, \`variables\`: \`[{ "enabled": true, "key": "baseUrl", "secret": false, "value": "https://staging.example.com" }]\`. For secrets use \`"secret": true\` and \`"value": ""\`; the user fills the value in Aurolis, which keeps it on their computer.

## Checklist

- File and folder names are slugs of \`name\`; \`.req.json\` for requests, \`.env.json\` for environments.
- Unique \`id\` everywhere (UUID v4), letters, numbers, \`-\` and \`_\` only.
- Keys sorted, 2-space indentation, final newline.
- No secret values, tokens or personal data anywhere.
`;
}

function folderLines(
  folder: Folder,
  dir: string,
  depth: number,
  paths: Record<string, string>,
): string[] {
  const indent = "  ".repeat(depth);
  const lines = [`${indent}- 📁 ${folder.name} (\`${dir}\`)`];
  for (const item of [...folder.items].sort((a, b) => a.seq - b.seq)) {
    lines.push(...itemLines(item, depth + 1, paths));
  }
  return lines;
}

function itemLines(
  item: Folder | Collection["items"][number],
  depth: number,
  paths: Record<string, string>,
): string[] {
  const path = paths[item.id] ?? "";
  if (item.type === "folder") {
    return folderLines(
      item,
      path.replace(/\/_folder\.json$/, ""),
      depth,
      paths,
    );
  }
  const indent = "  ".repeat(depth);
  const label =
    item.protocol === "http" ? item.method : item.protocol.toUpperCase();
  const examples =
    item.examples.length > 0
      ? `, ${item.examples.length} example${item.examples.length === 1 ? "" : "s"}`
      : "";
  return [
    `${indent}- ${label} ${item.name}: \`${item.url || "(no URL)"}\` (\`${path.split("/").pop()}\`${examples})`,
  ];
}

function workspaceMap(input: AssistantKitInput) {
  const { workspace } = input;
  const { paths } = toFilesWithPaths(workspace);
  const sections: string[] = [
    `# Workspace map: ${workspace.manifest.workspace.name}`,
    "",
    `A snapshot of the collections and environments when this skill was generated. List the folders for the current state. Paths are relative to the workspace root (\`${input.root || "."}\`).`,
    "",
    "## Collections",
    "",
  ];
  if (workspace.collections.length === 0) {
    sections.push("No collections yet.", "");
  }
  for (const collection of [...workspace.collections].sort(
    (a, b) => a.seq - b.seq,
  )) {
    const dir = (paths[collection.id] ?? "").replace(
      /\/_collection\.json$/,
      "",
    );
    sections.push(`### ${collection.name}`, "", `Folder: \`${dir}\``, "");
    if (collection.auth.type !== "none" && collection.auth.type !== "inherit") {
      sections.push(`Auth: ${collection.auth.type}`, "");
    }
    const variables = collection.variables
      .filter((variable) => variable.key)
      .map((variable) => `\`{{${variable.key}}}\``);
    if (variables.length > 0) {
      sections.push(`Collection variables: ${variables.join(", ")}`, "");
    }
    const lines = [...collection.items]
      .sort((a, b) => a.seq - b.seq)
      .flatMap((item) => itemLines(item, 0, paths));
    sections.push(...(lines.length > 0 ? lines : ["No requests yet."]), "");
  }
  sections.push("## Environments", "");
  const environments = [
    ...workspace.environments,
    ...(workspace.globals ? [workspace.globals] : []),
  ];
  if (environments.length === 0) sections.push("No environments yet.", "");
  for (const environment of environments) {
    const file = paths[environment.id] ?? `${ENVIRONMENTS_DIR}/`;
    const keys = environment.variables
      .filter((variable) => variable.key)
      .map(
        (variable) =>
          `\`{{${variable.key}}}\`${variable.secret ? " (secret)" : ""}`,
      );
    const isDefault =
      workspace.manifest.defaultEnvironment === environment.id
        ? " (default)"
        : "";
    sections.push(
      `- ${environment.name}${isDefault}, \`${file}\`: ${keys.length > 0 ? keys.join(", ") : "no variables"}`,
    );
  }
  return `${sections.join("\n").trimEnd()}\n`;
}

function cursorRule(input: AssistantKitInput) {
  const root = input.root ? `${input.root}/` : "";
  const body = skill(input).replace(/^---[\s\S]*?---\n\n/, "");
  return `---
description: How to add and update API requests and saved responses in the "${input.workspace.manifest.workspace.name}" Aurolis workspace (JSON files in git). Use when adding endpoints, saving API responses or examples, or editing collections and environments.
globs: ${root}${MANIFEST_PATH},${root}${COLLECTIONS_DIR}/**,${root}${ENVIRONMENTS_DIR}/**
alwaysApply: false
---

${body
  .replaceAll(
    "[reference.md](reference.md#request-files)",
    "the request file format below",
  )
  .replaceAll(
    "[reference.md](reference.md#example-files)",
    "the example file format below",
  )
  .replaceAll(
    "[workspace-map.md](workspace-map.md)",
    "The workspace map below",
  )}
${reference(input).replace(/^# /, "# Reference: ")}
${workspaceMap(input)}`;
}

export function buildAssistantKit(
  input: AssistantKitInput,
): Record<AssistantPath, string> {
  return {
    [SKILL_PATH]: skill(input),
    [REFERENCE_PATH]: reference(input),
    [MAP_PATH]: workspaceMap(input),
    [CURSOR_RULE_PATH]: cursorRule(input),
  };
}
