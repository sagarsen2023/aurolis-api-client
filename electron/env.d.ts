// Vite injects VITE_* variables into the main-process bundle at build time.
interface ImportMetaEnv {
  readonly VITE_PUBLIC_GITHUB_CLIENT_ID?: string;
  readonly VITE_PUBLIC_GITHUB_APP_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
