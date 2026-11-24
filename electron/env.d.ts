// Vite injects VITE_* variables into the main-process bundle at build time,
// so only public values belong here. Never add secrets.
interface ImportMetaEnv {
  /** Client ID of the Aurolis GitHub App (public, starts with "Iv"). */
  readonly VITE_PUBLIC_GITHUB_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
