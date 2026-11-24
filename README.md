# Aurolis

Desktop API client built with React, Vite, Tailwind v4 and shadcn/ui, packaged with Electron.

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
- `electron/preload.ts`: exposes `window.aurolis` (platform and versions) to the renderer.
- `electron-builder.json5`: packaging config; the app icon is `build/icon.png`.
- `src/index.css`: Aurolis design tokens mapped to shadcn variables (light in `:root`, dark in `.dark`).
- `public/aurolis-logo/`: favicon, marks and horizontal lockups used by the app.
