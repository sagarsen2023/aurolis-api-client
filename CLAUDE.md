# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Tauri window with Vite hot reload
npm run build        # Type-check, then build the frontend into dist/
npm run error-check  # TypeScript type check only
npm run lint         # ESLint (Prettier runs as an ESLint rule)
npm run lint:fix     # ESLint + Prettier auto-fix
npm run lint:rust    # Clippy on src-tauri, warnings are errors
npm run test:rust    # Rust unit tests
npm run dist         # Package installers for the current OS into src-tauri/target/release/bundle/
npm run release      # Bump the version, tag vX.Y.Z and push; the tag starts the release workflow
```

Install with `npm ci`. Keep `package-lock.json` in sync with `package.json` (run `npm install` after changing dependencies). Keep the `@tauri-apps/*` npm packages and the `tauri*` crates on the same minor versions.

## What Aurolis is

A local-first, open-source desktop API client (Tauri 2 + React). Each workspace is a git repository on the user's machine; pushing to GitHub (or any git host) is optional. There is no Aurolis backend and no client secret anywhere.

## Architecture

### Rust backend and frontend

- **`src-tauri/`: Rust backend.** Everything that touches the OS, tokens or GitHub:
  - `lib.rs`: builds the app, plugins (single instance, dialog, opener, updater, process), app state and the main window (created from `tauri.conf.json` with `create: false`; links that leave the app open in the browser).
  - `commands.rs`: every `#[tauri::command]`, as thin wrappers over the modules below.
  - `outcome.rs`: `Failure` and `Outcome<T>`, serialized as `{ ok: true, data } | { ok: false, error }`.
  - `paths.rs`: paths in the app data folder (`AUROLIS_DATA_DIR` overrides it) and atomic writes.
  - `vault.rs`: AES-256-GCM with a key kept in the OS keychain (`keyring`). Without a keychain, nothing is sealed and sessions and secrets stay in memory.
  - `github/`: `auth.rs` (GitHub App sign-in with the OAuth device flow; the session is sealed with the vault and never leaves the backend), `api.rs` (the only HTTP client for GitHub: token, refresh-on-401, typed errors, api.github.com only), `sync.rs` (installations, repositories and permissions, creating or checking an empty repository to publish to).
  - `git.rs`: runs the system git (2.31 or newer; Aurolis doesn't bundle git), one queue per repository, GitHub token through per-command environment config, typed errors.
  - `registry.rs`, `workspace.rs`, `watcher.rs`: the workspace registry (`<data>/workspaces.json`), storage folder and its checks, create / clone / open folder / open / initialize / rename / publish / stop syncing / remove, and file watching.
  - `files.rs`: reads workspace files and applies validated file changes (writes, deletes, manifest) inside a workspace's areas; also the per-user drafts and open tabs in the workspace's state folder.
  - `secrets.rs`: secret environment values in `state/secrets.bin`, sealed with the vault. Merged into a workspace when it opens; never written to the repository.
  - `source_control.rs`: lists changed files, checks for secret values, then commits, merges the upstream and pushes. Also pulls (fetch and merge) when a workspace is opened.
  - `transfer.rs`, `dialogs.rs`: saves an export through the native save dialog; folder picking.
  - `assistants.rs`: writes the AI assistant kit (`.claude/skills/aurolis-workspace/*` and `.cursor/rules/aurolis-workspace.mdc`) to the repository root. Only those four paths are accepted; they're also in `workspace_pathspecs`, so the commit dialog shows and commits them.
  - `engines/`: the three request engines. `http.rs` (reqwest with rustls and the platform verifier; cancel and timeout), GraphQL runs over it from the frontend, `realtime.rs` (WebSocket through `tokio-tungstenite`, Socket.IO through `socketio.rs`, events emitted on `aurolis:realtime-event`). Errors are typed and returned as values.
  - `engines/load.rs`: load tests. Virtual users send one prepared HTTP request (GraphQL is turned into its POST in `src/desktop/graphql.ts`) in a loop on the HTTP engine's client, for a duration or a number of requests, with optional ramp-up and pause. Latency goes into a log-scale histogram (2% buckets) plus per-second points; a snapshot is emitted on `aurolis:load-event` every 250 ms and once at the end. One run at a time.
  - Workspaces are local git repositories. Sync is plain git: status, diff, commit, fetch, merge, push.
- **`src/desktop/`: the bridge.** Implements `window.aurolis` (typed in `src/aurolis-bridge.d.ts`) over `invoke` and `listen`, installed first in `src/main.tsx`. Collection operations, the workspace file format, change descriptions and GraphQL run here in TypeScript and send only file changes to the backend.
- **`src/`: frontend (React).** UI only. It never sees a token, never calls GitHub directly and never sends requests itself.

### Command rules

- Commands are snake_case Rust functions registered in `generate_handler!` in `lib.rs` and allowed by `capabilities/default.json` where a plugin permission is needed. Events are named `aurolis:<area>-<event>`.
- Expose **specific operations**, never a generic "call any endpoint" or "read any file" command.
- Treat everything from the frontend as untrusted: validate it in Rust (names, ids, paths, sizes).
- Return errors as values (`Outcome<T>`) so typed codes survive the bridge. Frontend services unwrap them and throw a typed failure (`GithubApiFailure`, `GithubSignInFailure`).
- When adding a command, update `commands.rs`, `lib.rs`, `src/desktop/tauri-bridge.ts`, `src/aurolis-bridge.d.ts` and the matching service in `src/services/`.

### Updates

- The updater plugin reads `latest.json` from the latest GitHub release (`plugins.updater` in `tauri.conf.json`). `src/services/update.service.ts` checks and installs, `use-update-check.ts` checks in the background, `src/modules/updates/` is the popup and `src/modules/settings/updates-section.tsx` the settings section.
- `.github/workflows/release.yml` runs on a `v*` tag: one draft release, tauri-action builds into it, then it checks the assets and publishes. The signing key is only in the `TAURI_SIGNING_PRIVATE_KEY` secret; never commit it.

### Collections and requests

- Pure, shared logic lives in `src/lib/` and is imported by the frontend and `src/desktop/`: `collection-ops.ts` (operations on the parsed tree), `request-factory.ts`, `prepare-request.ts` (variables, inherited auth, query params, body) and `variables.ts` (`{{name}}`: environment, then collection variables, then globals).
- The frontend prepares a request, then calls an engine service (`http-engine.service.ts`, `graphql-engine.service.ts`, `realtime-engine.service.ts`).
- `src/modules/collections/`: `tree/`, `dialogs/`, `editor/` (one editor per protocol), `response/` and `views/` (collection, folder and example tabs).
- `src/modules/load-testing/`: the load testing screen (run settings, live results with SVG charts, earlier runs for this session). State is in `src/context/load-testing-context.ts`; `use-load-test.ts` prepares the request like a normal send (drafts included) and listens for snapshots from the app shell.
- `src/modules/environments/`: globals and environments, with secret variables. `src/modules/source-control/`: the commit dialog.
- Swagger docs: `src/lib/openapi.ts` builds an OpenAPI 3.0.3 document from collections (`{{var}}` at the start of a URL becomes a server variable, `{{var}}` and `:var` path segments become path parameters, saved examples become responses, inherited auth becomes security schemes; WebSocket and Socket.IO requests are skipped). `src/utils/openapi.ts` turns it into an export file; the Swagger icon button in a collection's header and the Swagger format on the Export screen use it.
- AI assistants: `src/lib/assistant-kit.ts` generates the Claude Code skill (SKILL.md, reference.md with the file format, workspace-map.md) and the Cursor rule from the open workspace. Keep reference.md in step with `workspace-format.ts` and the schemas in `src/validators/workspace.schema.ts`. Settings → AI assistants writes it to the repository or downloads it as a zip, and has a setup guide per assistant.
- Import and export: `src/utils/postman.ts` and `src/utils/hoppscotch.ts` convert between those formats and Aurolis collections and environments; `src/lib/transfer.ts` holds the shared pieces (variable syntax, credential replacement). `src/modules/import-export/` is the screen; imports go through the `import-collection` and `import-environment` operations.
- Editor state is in `src/context/collections-context.ts`. `use-editor-state-sync.ts` loads and persists drafts, tabs and the selected environment, and `use-request-drafts.ts` handles drafts and saving.
- Long descriptions (workspace, collection, folder and request docs) are markdown, edited with `src/components/ui/markdown-editor` (Write and Preview, preview by default when there is content).
- Code (JSON, XML, GraphQL, message bodies, response bodies) uses CodeMirror 6 through `src/components/code-field.tsx` (lazy-loaded) and `code-editor.tsx`. Theme, `{{variable}}` highlighting and completion, and the language setup live in `src/lib/codemirror/`. Pass stable props: react-codemirror reconfigures the editor whenever `extensions`, `basicSetup` or `onChange` change identity, which resets autocompletion.

### Routing

**TanStack Router** with file-based routes in `src/routes/` (`src/routeTree.gen.ts` is generated). `(auth)` holds sign-in; `(authenticated)` is the app shell with an auth guard in `beforeLoad`. `__root.tsx` renders the title bar and the toaster.

### State

**Jotai** atoms in `src/context/` (e.g. `workspace-context.ts`, `breadcrumb-context.ts`). `theme-context.tsx` is a React context and also syncs the native window theme through `window.aurolis.setTheme`.

### Services and `usePromise`

- Services live in `src/services/*.service.ts` as plain objects (`authService`, `githubService`). Desktop-only features go through `window.aurolis`.
- Call services from components with `usePromise` (`src/hooks/usePromise.ts`): it returns `{ loading, runPromise }`, shows `toast.error(error.message)` on failure, and runs `onSuccess` / `onError` / `onFinally` callbacks. Use it instead of `useState` + `try/catch`.
- Pass `showErrorToast: false` when the component shows the error itself. Return a value instead of throwing for outcomes that aren't errors (e.g. a cancelled sign-in).
- `handleError(error)` toasts an error caught elsewhere.
- Toasts use `sonner` via `<ThemeToast />` (`src/components/ui/theme-toast.tsx`), which follows the app theme.

### Folder conventions (calmui)

- `src/components/ui/`: shadcn primitives (ESLint ignores this folder). Add them with `npx shadcn add <name>` (style `base-maia`, Base UI). `Input` and `Textarea` take `label` and `error`, like in the other calmui projects.
- `src/modules/<feature>/`: feature components (`auth`, `dashboard`, `layout`, `updates`).
- `src/services/`: service objects; `src/services/config/` holds `desktop-bridge.ts` (access to `window.aurolis`) and `engine-bridge.ts`.
- `src/types/<feature>/*.type.ts`: types, also used by `src/desktop/`.
- `src/constants/`: static data and user-facing messages (e.g. error messages per code).
- `src/hooks/`, `src/context/`, `src/utils/`, `src/lib/`.

## Environment variables

Prefix every variable with `VITE_PUBLIC_`. They are inlined into the built app (and `src-tauri/build.rs` passes the GitHub ones to the Rust build), so **only public values**: never add a secret.

- `VITE_PUBLIC_GITHUB_CLIENT_ID`: Client ID of the Aurolis GitHub App.
- `VITE_PUBLIC_GITHUB_APP_SLUG`: the app's slug from `github.com/apps/<slug>`, for the install link.

Copy `.env.example` to `.env` (gitignored).

## Key conventions

- **No `console.*`**: ESLint enforces `no-console: error`.
- Unused variables must start with `_`.
- Prettier (with `prettier-plugin-tailwindcss`) runs through ESLint; run `npm run lint:fix` before committing.
- Tailwind CSS v4: no `tailwind.config.js`; tokens are CSS variables in `src/index.css` (light in `:root`, dark in `.dark`).
- Don't add code comments; write self-explanatory code.
