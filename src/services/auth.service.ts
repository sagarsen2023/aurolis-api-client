// GitHub sign-in via the device flow. The work happens in the Electron main
// process (see electron/github-auth.ts): GitHub's device-flow endpoints don't
// allow browser requests, and the token is kept out of page code.
// GithubUser, GithubDeviceCodePrompt and GithubSignInError are global types
// declared in src/electron.d.ts.

export class GithubSignInFailure extends Error {
  readonly code: GithubSignInError;

  constructor(code: GithubSignInError) {
    super(SIGN_IN_ERROR_MESSAGES[code]);
    this.name = "GithubSignInFailure";
    this.code = code;
  }
}

export const SIGN_IN_ERROR_MESSAGES: Record<GithubSignInError, string> = {
  cancelled: "Sign-in was cancelled.",
  expired: "The code expired before it was approved. Try again.",
  access_denied: "Access was denied on GitHub.",
  device_flow_disabled:
    "Device sign-in isn't enabled for this GitHub app. Turn on Device Flow in its settings.",
  not_configured:
    "GitHub sign-in isn't configured. Set VITE_GITHUB_CLIENT_ID and restart the app.",
  network: "Couldn't reach GitHub. Check your connection and try again.",
  unknown: "GitHub sign-in failed. Try again.",
};

function bridge() {
  const github = window.aurolis?.github;
  if (!github) {
    throw new Error("GitHub sign-in is only available in the desktop app.");
  }
  return github;
}

export const authService = {
  /**
   * Runs the whole device flow. `onCode` receives the code to show the user
   * (the verification page is already opened in their browser). Resolves with
   * the signed-in user, or throws a GithubSignInFailure.
   */
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

  getStatus: async () =>
    (await window.aurolis?.github.getStatus()) ?? {
      signedIn: false,
      user: null,
    },

  isSignedIn: async () => (await authService.getStatus()).signedIn,

  logout: async () => {
    await window.aurolis?.github.signOut();
  },
};
