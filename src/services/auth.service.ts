import { SIGN_IN_ERROR_MESSAGES } from "@/constants/auth";
import type { GithubSignInError } from "@/types/auth/auth-error.type";
import type {
  GithubDeviceCodePrompt,
  GithubUser,
} from "@/types/auth/auth-response.type";
import { desktopBridge } from "./config/desktop-bridge";

export class GithubSignInFailure extends Error {
  readonly code: GithubSignInError;

  constructor(code: GithubSignInError) {
    super(SIGN_IN_ERROR_MESSAGES[code]);
    this.name = "GithubSignInFailure";
    this.code = code;
  }
}

const LOCAL_MODE_KEY = "aurolis:local-mode";

const bridge = () =>
  desktopBridge(
    "github",
    "GitHub sign-in is only available in the desktop app.",
  );

export const authService = {
  loginViaGithub: async (
    onCode: (prompt: GithubDeviceCodePrompt) => void,
  ): Promise<GithubUser | null> => {
    const github = bridge();

    const start = await github.startSignIn();
    if (!start.ok) throw new GithubSignInFailure(start.error);
    onCode(start.prompt);

    const result = await github.waitForSignIn();
    if (!result.ok) throw new GithubSignInFailure(result.error);
    return result.user;
  },

  cancelGithubLogin: async () => {
    await window.aurolis?.github.cancelSignIn();
  },

  getStatus: async () => {
    const status = await window.aurolis?.github.getStatus();
    return status ?? { signedIn: false, user: null };
  },

  isSignedIn: async () => {
    const status = await authService.getStatus();
    return status.signedIn;
  },

  continueLocally: () => {
    localStorage.setItem(LOCAL_MODE_KEY, "true");
  },

  isLocalMode: () => localStorage.getItem(LOCAL_MODE_KEY) === "true",

  leaveLocalMode: () => {
    localStorage.removeItem(LOCAL_MODE_KEY);
  },

  canEnterApp: async () => {
    if (authService.isLocalMode()) return true;
    return authService.isSignedIn();
  },

  logout: async () => {
    authService.leaveLocalMode();
    await window.aurolis?.github.signOut();
  },
};
