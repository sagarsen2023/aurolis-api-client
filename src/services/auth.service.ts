import { SIGN_IN_ERROR_MESSAGES } from "@/constants/auth";
import type { GithubSignInError } from "@/types/auth/auth-error.type";
import type {
  GithubDeviceCodePrompt,
  GithubUser,
} from "@/types/auth/auth-response.type";

export class GithubSignInFailure extends Error {
  readonly code: GithubSignInError;

  constructor(code: GithubSignInError) {
    super(SIGN_IN_ERROR_MESSAGES[code]);
    this.name = "GithubSignInFailure";
    this.code = code;
  }
}

function bridge() {
  const github = window.aurolis?.github;
  if (!github) {
    throw new Error("GitHub sign-in is only available in the desktop app.");
  }
  return github;
}

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

  /** Stops a sign-in in progress; loginViaGithub then throws "cancelled". */
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

  logout: async () => {
    await window.aurolis?.github.signOut();
  },
};
