// Vite injects VITE_* variables into the main-process bundle at build time.
interface ImportMetaEnv {
  readonly VITE_GITHUB_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
