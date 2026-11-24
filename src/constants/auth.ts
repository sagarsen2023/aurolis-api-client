import type { GithubSignInError } from "@/types/auth/auth-error.type";

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
