# Aurolis

Desktop API client built with React, Vite, Tailwind v4 and shadcn/ui, packaged with Tauri 2 and a Rust backend.

Collections hold HTTP (REST), GraphQL, WebSocket and Socket.IO requests, each saved as a `*.req.json` file in the workspace's git repository, with saved examples next to them. Requests run in the Rust backend through three engines, so there is no CORS and any header can be set.

Collections and environments can be imported from and exported to Postman (Collection v2.1) and Hoppscotch (including its workspace export .zip).

## Requirements

- Node.js 24 and npm.
- Rust 1.90 or newer (`rustup`).
- Git 2.31 or newer on the `PATH`. Aurolis uses the system git and doesn't bundle one.
- The Tauri system packages for your OS: <https://v2.tauri.app/start/prerequisites/>. On Debian or Ubuntu:
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev librsvg2-dev libxdo-dev build-essential file
  ```

## Scripts

| Command                                               | What it does                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run dev`                                         | Starts Vite and opens the Tauri window with hot reload                                    |
| `npm run dev:web`                                     | Starts only the Vite dev server (no desktop features)                                     |
| `npm run build`                                       | Type-checks and builds the frontend into `dist/`                                          |
| `npm run dist`                                        | Builds and packages installers for the current OS into `src-tauri/target/release/bundle/` |
| `npm run dist:mac` / `dist:win` / `dist:linux`        | Packages for a specific target (`dist:mac` builds a universal app)                        |
| `npm run lint` / `lint:rust`                          | ESLint for the frontend, Clippy for the Rust backend                                      |
| `npm run test:rust`                                   | Runs the Rust unit tests                                                                  |
| `npm run release` / `release:minor` / `release:major` | Bumps the version, tags it and pushes the tag, which starts the release build             |

## Layout

- `src-tauri/src/lib.rs`: builds the app, registers the plugins and commands, and creates the main window.
- `src-tauri/src/commands.rs`: every command the frontend can invoke. Each one validates its input and returns `{ ok, data }` or `{ ok, error }`.
- `src-tauri/src/github/`: GitHub sign-in with the device flow (`auth.rs`), the REST client (`api.rs`) and the operations the app needs (`sync.rs`).
- `src-tauri/src/git.rs`, `workspace.rs`, `registry.rs`, `files.rs`, `watcher.rs`, `source_control.rs`: workspaces as local git repositories, their files, the workspace registry and commit, pull and push.
- `src-tauri/src/vault.rs`, `secrets.rs`: encryption with a key kept in the OS keychain, and secret environment values stored outside the repository.
- `src-tauri/src/engines/`: the HTTP, GraphQL and realtime (WebSocket and Socket.IO) engines that send requests.
- `src-tauri/tauri.conf.json`: window, security policy, bundling and updater config. `tauri.linux.conf.json` and `tauri.windows.conf.json` swap the macOS title bar for custom window controls.
- `src/desktop/`: implements `window.aurolis` on top of Tauri commands and events. Collection and file-format logic stays in TypeScript (`src/lib/`) and runs here.
- `src/index.css`: Aurolis design tokens mapped to shadcn variables (light in `:root`, dark in `.dark`).
- `public/aurolis-logo/`: favicon, marks and horizontal lockups used by the app. The app icons in `src-tauri/icons/` are generated from `build/icon.png` with `npx tauri icon build/icon.png`.

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
   Both are public and get built into the app (the frontend and the Rust backend both read them). `.env` is gitignored.
3. Run `npm run dev` and choose **Continue with GitHub**.

### How tokens are handled

- The whole flow runs in the Rust backend (`src-tauri/src/github/auth.rs`). The frontend only sees the user code and the signed-in user, never a token.
- Tokens are encrypted with AES-256-GCM under a key kept in the OS keychain (macOS Keychain, Windows Credential Manager, Secret Service on Linux) and written to the app's data folder. Without an OS keychain they're kept in memory only, so users sign in again after a restart.
- Access tokens last 8 hours and are refreshed automatically, without a client secret, because they come from the device flow. Each refresh also renews the 6-month refresh token, so users stay signed in as long as they open Aurolis at least once every 6 months.
- A GitHub App only sees repositories it's installed on. Users install it from `https://github.com/apps/<app-slug>/installations/new`.

### Calling GitHub

Use `githubService` (`src/services/github.service.ts`). Every call runs in the Rust backend, so the token never reaches the frontend, and failures throw `GithubApiFailure` with a `code` to branch on.

| Method                                       | What it does                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getInstallations()`                         | Accounts the app is installed on. When this is empty after sign-in, the sign-in screen shows an install step that opens the install page and continues once an installation appears. |
| `getRepositories()`                          | Repositories reachable through the app, with the user's `permissions` (`push` = can commit).                                                                                         |
| `createRepository({ owner, name, private })` | Creates an empty repository for the user or an organization. Throws `already_exists` if the name is taken, or `forbidden` if the app may not create repositories there.              |
| `getEmptyRepository({ owner, name })`        | Returns the repository only if Aurolis can see it, the user can push and it has no commits; otherwise `not_found`, `forbidden` or `not_empty`.                                       |

Error codes: `signed_out`, `offline`, `rate_limited` (with `resetAt`), `not_installed`, `not_found`, `forbidden`, `conflict`, `empty_repository`, `already_exists`, `not_empty`, `too_large`, `validation`, `invalid_input`, `server`, `unknown`. Messages for each are in `src/constants/github.ts`.

Add new GitHub features as a function in `src-tauri/src/github/sync.rs` plus a command, not as a generic "call any endpoint" bridge, so frontend code can only do what Aurolis needs.

## Releases and updates

Aurolis updates itself from GitHub releases. Every few hours, and a few seconds after it starts, the app reads `latest.json` from the latest release. When a newer version is there, it shows a popup and marks **Settings → Updates**. The update is downloaded, its signature is checked against the public key in `tauri.conf.json`, and the app restarts.

### One-time setup

1. Generate the updater key pair on your own machine. Keep the private key out of the repository:
   ```bash
   npm run tauri signer generate -- -w ~/.tauri/aurolis.key
   ```
2. Put the contents of `~/.tauri/aurolis.key.pub` in `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.
3. In the repository's **Settings → Secrets and variables → Actions**, add:
   - Secrets: `TAURI_SIGNING_PRIVATE_KEY` (the contents of `~/.tauri/aurolis.key`) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
   - Variables: `VITE_PUBLIC_GITHUB_CLIENT_ID` and `VITE_PUBLIC_GITHUB_APP_SLUG`.

If the private key is lost, installed copies can't verify new updates, and users have to download the next version by hand.

### Publishing a release

1. Optionally write the notes in `release-notes/vX.Y.Z.md`. They appear in the release and in the update popup. Without the file, GitHub generates notes from the merged pull requests.
2. On a clean, up-to-date branch, run `npm run release` (or `release:minor` / `release:major`). It runs the checks, bumps the version in `package.json`, `Cargo.toml` and `Cargo.lock`, commits, tags `vX.Y.Z` and pushes.
3. The tag starts `.github/workflows/release.yml`. It creates one draft release, builds macOS (universal), Windows and Linux in parallel into it, checks that every installer and `latest.json` are attached, then publishes it. Installed apps see the update once it's published.

macOS builds are signed ad hoc, not with an Apple Developer ID. On first launch, users right-click the app and choose **Open**.

## License

[MIT](LICENSE)
