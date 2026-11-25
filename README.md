# Aurolis

Desktop API client built with React, Vite, Tailwind v4 and shadcn/ui, packaged with Electron.

Collections hold HTTP (REST), GraphQL, WebSocket and Socket.IO requests, each saved as a `*.req.json` file in the workspace's git repository, with saved examples next to them. Requests run in the main process through three engines, so there is no CORS and any header can be set.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts Vite and opens the Electron window with hot reload |
| `npm run build` | Type-checks and builds the renderer (`dist/`) and Electron main/preload (`dist-electron/`) |
| `npm start` | Runs the last build in Electron |
| `npm run dist` | Builds and packages installers for the current OS into `release/<version>/` |
| `npm run dist:mac` / `dist:win` / `dist:linux` | Packages for a specific platform |

## Layout

- `electron/main.ts`: main process. Serves the built app from `app://aurolis/` in production.
- `electron/preload.ts`: exposes `window.aurolis` (platform, versions, theme sync and GitHub sign-in) to the renderer.
- `electron/github-auth.ts`: GitHub sign-in with the device flow; keeps tokens in the main process, encrypted with the OS keychain.
- `electron/github-api.ts`: GitHub REST client for the main process (the counterpart of `src/services/config/fetch-api.ts`): attaches the token, refreshes once on 401, maps errors to typed codes.
- `electron/github-sync.ts`: the GitHub operations the renderer can call over IPC: installations, repositories, creating or checking a repository to publish to, pull and commit.
- `electron/collection-store.ts`: creates, saves and deletes collections, folders, requests and examples as workspace files, and keeps drafts and open tabs outside the repo.
- `electron/engines/`: the HTTP, GraphQL and realtime (WebSocket and Socket.IO) engines that send requests.
- `electron-builder.json5`: packaging config; the app icon is `build/icon.png`.
- `src/index.css`: Aurolis design tokens mapped to shadcn variables (light in `:root`, dark in `.dark`).
- `public/aurolis-logo/`: favicon, marks and horizontal lockups used by the app.

## GitHub sign-in

Aurolis signs in with a **GitHub App** using the **device flow**. There is no backend and no client secret: the app shows a code, the user enters it at github.com/login/device, and GitHub returns a token to the desktop app.

### Setup

1. Create a GitHub App (**Settings → Developer settings → GitHub Apps → New GitHub App**):
   - Tick **Enable Device Flow** and **Expire user authorization tokens**.
   - Leave the callback URL empty and turn the webhook off.
   - Repository permissions: **Contents** and **Pull requests** → Read and write. Account permissions: **Email addresses** → Read-only.
   - To let users create a repository when they publish a local workspace, also set **Administration** → Read and write. Without it, publishing still works to an empty repository the user creates on github.com.
   - **Don't generate a client secret or a private key.** Aurolis doesn't use either.
2. Copy `.env.example` to `.env` and set the app's Client ID and slug:
   ```bash
   VITE_PUBLIC_GITHUB_CLIENT_ID=Iv23li...
   VITE_PUBLIC_GITHUB_APP_SLUG=aurolis   # from github.com/apps/<slug>
   ```
   Both are public and get built into the app. `.env` is gitignored.
3. Run `npm run dev` and choose **Continue with GitHub**.

### How tokens are handled

- The whole flow runs in the main process (`electron/github-auth.ts`). The renderer only sees the user code and the signed-in user, never a token.
- Tokens are encrypted with Electron's `safeStorage` (macOS Keychain, Windows DPAPI, libsecret/KWallet on Linux) and written to the app's user-data folder. Without an OS keychain they're kept in memory only, so users sign in again after a restart.
- Access tokens last 8 hours and are refreshed automatically, without a client secret, because they come from the device flow. Each refresh also renews the 6-month refresh token, so users stay signed in as long as they open Aurolis at least once every 6 months.
- A GitHub App only sees repositories it's installed on. Users install it from `https://github.com/apps/<app-slug>/installations/new`.

### Calling GitHub

Use `githubService` (`src/services/github.service.ts`). Every call runs in the main process, so the token never reaches the renderer, and failures throw `GithubApiFailure` with a `code` to branch on.

| Method | What it does |
|---|---|
| `getInstallations()` | Accounts the app is installed on. When this is empty after sign-in, the sign-in screen shows an install step that opens the install page and continues once an installation appears. |
| `getRepositories()` | Repositories reachable through the app, with the user's `permissions` (`push` = can commit). |
| `pullFiles({ owner, repo, branch, path, knownFiles })` | Reads the branch and downloads only files whose SHA differs from `knownFiles`. Returns `headSha`, `changed`, `deleted` and the full `files` map to keep for the next pull. |
| `commitFiles({ owner, repo, branch, message, changes, expectedHeadSha })` | Writes all changes as **one commit** (Git Data API) and moves the branch with `force: false`. If the branch moved since `expectedHeadSha`, nothing is written and it throws `conflict` with `remoteHeadSha`: pull, merge, then commit again. |

| `createRepository({ owner, name, private })` | Creates an empty repository for the user or an organization. Throws `already_exists` if the name is taken, or `forbidden` if the app may not create repositories there. |
| `getEmptyRepository({ owner, name })` | Returns the repository only if Aurolis can see it, the user can push and it has no commits; otherwise `not_found`, `forbidden` or `not_empty`. |

Error codes: `signed_out`, `offline`, `rate_limited` (with `resetAt`), `not_installed`, `not_found`, `forbidden`, `conflict`, `empty_repository`, `already_exists`, `not_empty`, `too_large`, `validation`, `invalid_input`, `server`, `unknown`. Messages for each are in `src/constants/github.ts`.

Add new GitHub features as a function in `electron/github-sync.ts` plus an IPC channel, not as a generic "call any endpoint" bridge, so renderer code can only do what Aurolis needs.
