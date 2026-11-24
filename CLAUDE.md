# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite + Electron window with hot reload
npm run build        # Type-check, then build renderer (dist/) and main/preload (dist-electron/)
npm run error-check  # TypeScript type check only
npm run lint         # ESLint (Prettier runs as an ESLint rule)
npm run lint:fix     # ESLint + Prettier auto-fix
npm run dist         # Package installers for the current OS into release/<version>/
```

Install with `npm ci`. Keep `package-lock.json` in sync with `package.json` (run `npm install` after changing dependencies).

## What Aurolis is

A local-first, open-source desktop API client (Electron + React). Each workspace is a git repository on the user's machine; pushing to GitHub (or any git host) is optional. There is no Aurolis backend and no client secret anywhere.

The workspace, storage, switching and sync model is defined in [`docs/workspace-architecture.md`](docs/workspace-architecture.md). Read it before working on workspaces or GitHub sync, and keep it up to date when that model changes.

## Architecture

### Two processes

- **`electron/`: main process (Node).** Everything that touches the OS, tokens or GitHub:
  - `main.ts`: window, `app://aurolis/` protocol, CSP, IPC handlers.
  - `preload.ts`: the only bridge, exposed as `window.aurolis`. Typed in `src/electron.d.ts`.
  - `github-auth.ts`: GitHub App sign-in with the OAuth device flow. Tokens are encrypted with `safeStorage` and never leave the main process.
  - `github-api.ts`: `githubApi`, the main-process counterpart of `src/services/config/fetch-api.ts` (token, refresh-on-401, typed errors, api.github.com only).
  - `github-sync.ts`: GitHub REST operations the renderer may call: installations, repositories and permissions, and (later) pull requests.
  - `git.ts`: runs the system git (2.31 or newer; Aurolis doesn't bundle git), one queue per repository, GitHub token through per-command environment config, typed errors.
  - `workspace-store.ts`: the workspace registry (`<userData>/workspaces.json`), storage folder and its checks, create / clone / open folder / open / initialize / rename / remove, and file watching.
  - Workspaces are local git repositories (see the architecture doc). Sync is plain git: status, diff, commit, fetch, merge, push.
- **`src/`: renderer (React).** UI only. It never sees a token and never calls GitHub directly.

### IPC rules

- Channels are named `aurolis:<area>:<action>` and registered in `electron/main.ts` behind the `fromAppWindow` check.
- Expose **specific operations**, never a generic "call any endpoint" or "read any file" channel.
- Treat everything from the renderer as untrusted: validate it in the main process (names, ids, paths, sizes).
- Return errors as values (`{ ok: true, data } | { ok: false, error }`) so typed codes survive IPC. Renderer services unwrap them and throw a typed failure (`GithubApiFailure`, `GithubSignInFailure`).
- When adding a channel, update `electron/preload.ts`, `src/electron.d.ts` and the matching service in `src/services/`.

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

- `src/components/ui/`: shadcn primitives (ESLint ignores this folder).
- `src/modules/<feature>/`: feature components (`auth`, `dashboard`, `layout`).
- `src/services/`: service objects; `src/services/config/` holds `fetch-api.ts` and `query-urls.ts`.
- `src/types/<feature>/*.type.ts`: types, also imported by `electron/` with relative `.ts` paths.
- `src/constants/`: static data and user-facing messages (e.g. error messages per code).
- `src/hooks/`, `src/context/`, `src/utils/`, `src/lib/`.

## Environment variables

Prefix every variable with `VITE_PUBLIC_`. They are inlined into the built app, so **only public values**: never add a secret.

- `VITE_PUBLIC_GITHUB_CLIENT_ID`: Client ID of the Aurolis GitHub App.
- `VITE_PUBLIC_GITHUB_APP_SLUG`: the app's slug from `github.com/apps/<slug>`, for the install link.

Copy `.env.example` to `.env` (gitignored).

## Key conventions

- **No `console.*`**: ESLint enforces `no-console: error`.
- Unused variables must start with `_`.
- Prettier (with `prettier-plugin-tailwindcss`) runs through ESLint; run `npm run lint:fix` before committing.
- Tailwind CSS v4: no `tailwind.config.js`; tokens are CSS variables in `src/index.css` (light in `:root`, dark in `.dark`).
- Don't add code comments; write self-explanatory code.
