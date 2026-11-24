import type { GithubSignInError } from "./auth-error.type.ts";

export interface GithubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export interface GithubDeviceCodePrompt {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

export interface GithubAuthStatus {
  signedIn: boolean;
  user: GithubUser | null;
}

export type GithubDeviceFlowStart =
  | { ok: true; prompt: GithubDeviceCodePrompt }
  | { ok: false; error: GithubSignInError };

export type GithubSignInResult =
  | { ok: true; user: GithubUser | null }
  | { ok: false; error: GithubSignInError };
