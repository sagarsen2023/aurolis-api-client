// GitHub sign-in via the OAuth device flow, run in the main process.
//
// The device-flow endpoints don't send CORS headers, so they can't be called
// from the renderer. Keeping the flow here also means the access token never
// reaches page code: it is encrypted with Electron's safeStorage (macOS
// Keychain, Windows DPAPI, libsecret/kwallet on Linux) and only used here.
//
// Docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow

import { app, net, safeStorage, shell } from "electron";
import path from "node:path";
import { readFile, rm, writeFile } from "node:fs/promises";

// Public identifier of the GitHub App / OAuth App; safe to ship in the binary.
// "Enable Device Flow" must be ticked in the app's settings on GitHub.
const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID ?? "";

// Ignored by GitHub Apps (their permissions are set on the app itself);
// used by classic OAuth Apps.
const SCOPE = "repo read:user";

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

const TOKEN_FILE = () => path.join(app.getPath("userData"), "github-token.bin");

export type GithubUser = {
  login: string;
  name: string | null;
  avatarUrl: string;
};

export type DeviceCodePrompt = {
  userCode: string;
  verificationUri: string;
  /** Seconds until the code expires. */
  expiresIn: number;
};

export type SignInResult =
  { ok: true; user: GithubUser | null } | { ok: false; error: SignInError };

export type SignInError =
  | "cancelled"
  | "expired"
  | "access_denied"
  | "device_flow_disabled"
  | "not_configured"
  | "network"
  | "unknown";

export type AuthStatus = { signedIn: boolean; user: GithubUser | null };

type PendingFlow = {
  deviceCode: string;
  interval: number;
  expiresAt: number;
  abort: AbortController;
};

let pending: PendingFlow | null = null;
// Fallback when the OS has no secret store (some Linux setups): the token
// then lives only for this session instead of being written in plain text.
let memoryToken: string | null = null;
// Status checked against GitHub once per session; reset on sign-in/out.
let cachedStatus: AuthStatus | null = null;

async function postForm<T>(url: string, body: Record<string, string>) {
  const response = await net.fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  return (await response.json()) as T;
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

// ---------------------------------------------------------------------------
// Token storage

async function saveToken(token: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    memoryToken = token;
    return;
  }
  await writeFile(TOKEN_FILE(), safeStorage.encryptString(token), {
    mode: 0o600,
  });
}

async function loadToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(await readFile(TOKEN_FILE()));
  } catch {
    return null;
  }
}

async function clearToken() {
  memoryToken = null;
  await rm(TOKEN_FILE(), { force: true });
}

// ---------------------------------------------------------------------------
// GitHub API

type UserFetch =
  | { kind: "ok"; user: GithubUser }
  | { kind: "unauthorized" }
  | { kind: "offline" };

async function fetchUser(token: string): Promise<UserFetch> {
  try {
    const response = await net.fetch(USER_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (response.status === 401) return { kind: "unauthorized" };
    if (!response.ok) return { kind: "offline" };
    const data = (await response.json()) as {
      login: string;
      name: string | null;
      avatar_url: string;
    };
    return {
      kind: "ok",
      user: { login: data.login, name: data.name, avatarUrl: data.avatar_url },
    };
  } catch {
    return { kind: "offline" };
  }
}

// ---------------------------------------------------------------------------
// Device flow

/** Step 1: ask GitHub for a user code and open the verification page. */
export async function startDeviceFlow(): Promise<
  { ok: true; prompt: DeviceCodePrompt } | { ok: false; error: SignInError }
> {
  if (!CLIENT_ID) return { ok: false, error: "not_configured" };

  cancelDeviceFlow();

  let start: {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    expires_in?: number;
    interval?: number;
    error?: string;
  };
  try {
    start = await postForm(DEVICE_CODE_URL, {
      client_id: CLIENT_ID,
      scope: SCOPE,
    });
  } catch {
    return { ok: false, error: "network" };
  }

  if (
    !start.device_code ||
    !start.user_code ||
    !start.verification_uri ||
    !start.expires_in
  ) {
    return {
      ok: false,
      error:
        start.error === "device_flow_disabled"
          ? "device_flow_disabled"
          : "unknown",
    };
  }

  pending = {
    deviceCode: start.device_code,
    interval: start.interval ?? 5,
    expiresAt: Date.now() + start.expires_in * 1000,
    abort: new AbortController(),
  };

  await shell.openExternal(start.verification_uri);

  return {
    ok: true,
    prompt: {
      userCode: start.user_code,
      verificationUri: start.verification_uri,
      expiresIn: start.expires_in,
    },
  };
}

/** Step 2: poll until the user approves (or denies) in the browser. */
export async function waitForAuthorization(): Promise<SignInResult> {
  const flow = pending;
  if (!flow) return { ok: false, error: "cancelled" };

  try {
    while (Date.now() < flow.expiresAt) {
      await sleep(flow.interval * 1000, flow.abort.signal);

      let r: { access_token?: string; error?: string; interval?: number };
      try {
        r = await postForm(ACCESS_TOKEN_URL, {
          client_id: CLIENT_ID,
          device_code: flow.deviceCode,
          grant_type: GRANT_TYPE,
        });
      } catch {
        // Transient network blip: keep polling until the code expires.
        continue;
      }

      if (r.access_token) {
        await saveToken(r.access_token);
        const result = await fetchUser(r.access_token);
        cachedStatus = {
          signedIn: true,
          user: result.kind === "ok" ? result.user : null,
        };
        return { ok: true, user: result.kind === "ok" ? result.user : null };
      }

      switch (r.error) {
        case "authorization_pending":
          continue;
        case "slow_down":
          // GitHub sends the new minimum interval; fall back to +5s.
          flow.interval = r.interval ?? flow.interval + 5;
          continue;
        case "expired_token":
          return { ok: false, error: "expired" };
        case "access_denied":
          return { ok: false, error: "access_denied" };
        case "device_flow_disabled":
          return { ok: false, error: "device_flow_disabled" };
        default:
          return { ok: false, error: "unknown" };
      }
    }
    return { ok: false, error: "expired" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, error: "cancelled" };
    }
    return { ok: false, error: "unknown" };
  } finally {
    if (pending === flow) pending = null;
  }
}

export function cancelDeviceFlow() {
  pending?.abort.abort();
  pending = null;
}

// ---------------------------------------------------------------------------
// Session

export async function getAuthStatus(): Promise<AuthStatus> {
  if (cachedStatus?.signedIn && cachedStatus.user) return cachedStatus;

  const token = await loadToken();
  if (!token) return { signedIn: false, user: null };

  const result = await fetchUser(token);
  if (result.kind === "unauthorized") {
    // Revoked on GitHub or expired: forget it.
    await clearToken();
    return { signedIn: false, user: null };
  }
  // Offline still counts as signed in: the app is local-first. Only a
  // confirmed user is cached, so an offline start is re-checked later.
  cachedStatus = {
    signedIn: true,
    user: result.kind === "ok" ? result.user : null,
  };
  return cachedStatus;
}

export async function signOut() {
  cancelDeviceFlow();
  cachedStatus = null;
  await clearToken();
}
