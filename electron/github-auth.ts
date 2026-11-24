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
import type {
  GithubAuthStatus,
  GithubDeviceFlowStart,
  GithubSignInResult,
  GithubUser,
} from "../src/types/auth/auth-response.type.ts";

// Public identifier of the GitHub App / OAuth App; safe to ship in the binary.
// "Enable Device Flow" must be ticked in the app's settings on GitHub.
const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID ?? "";
// Required by GitHub to exchange a ghr_ refresh token for a new ghu_ access token.
// Referenced only from this main-process module, so it is not in the renderer bundle.
const CLIENT_SECRET = import.meta.env.VITE_GITHUB_CLIENT_SECRET ?? "";

// Ignored by GitHub Apps (their permissions are set on the app itself);
// used by classic OAuth Apps.
const SCOPE = "repo read:user";

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const REFRESH_GRANT = "refresh_token";
// Refresh a minute early so a request doesn't leave with a token that expires mid-flight.
const EXPIRY_SKEW_MS = 60_000;

const TOKEN_FILE = () => path.join(app.getPath("userData"), "github-token.bin");

type PendingFlow = {
  deviceCode: string;
  interval: number;
  expiresAt: number;
  abort: AbortController;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  interval?: number;
};

type StoredGithubSession = {
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: number | null;
  refreshTokenExpiresAt: number | null;
};

let pending: PendingFlow | null = null;
// Fallback when the OS has no secret store (some Linux setups): the session
// then lives only for this process instead of being written in plain text.
let memorySession: StoredGithubSession | null = null;
let refreshInFlight: Promise<RefreshResult> | null = null;
// Status checked against GitHub once per session; reset on sign-in/out.
let cachedStatus: GithubAuthStatus | null = null;

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
// Token storage. One encrypted blob holds both the user access token (ghu_)
// and the refresh token (ghr_). GitHub rotates the refresh token on each use.

function expiresAt(seconds: number | undefined) {
  return typeof seconds === "number" ? Date.now() + seconds * 1000 : null;
}

function sessionFromResponse(
  response: TokenResponse,
  previous: StoredGithubSession | null = null,
): StoredGithubSession | null {
  if (!response.access_token) return null;
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token || previous?.refreshToken || null,
    accessTokenExpiresAt: expiresAt(response.expires_in),
    refreshTokenExpiresAt:
      expiresAt(response.refresh_token_expires_in) ??
      previous?.refreshTokenExpiresAt ??
      null,
  };
}

function parseStoredSession(raw: string): StoredGithubSession | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredGithubSession>;
    if (typeof parsed.accessToken === "string" && parsed.accessToken) {
      return {
        accessToken: parsed.accessToken,
        refreshToken:
          typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
        accessTokenExpiresAt:
          typeof parsed.accessTokenExpiresAt === "number"
            ? parsed.accessTokenExpiresAt
            : null,
        refreshTokenExpiresAt:
          typeof parsed.refreshTokenExpiresAt === "number"
            ? parsed.refreshTokenExpiresAt
            : null,
      };
    }
  } catch {
    // Older builds stored the access token as a bare string.
    if (raw) {
      return {
        accessToken: raw,
        refreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
      };
    }
  }
  return null;
}

async function saveSession(session: StoredGithubSession) {
  if (!safeStorage.isEncryptionAvailable()) {
    memorySession = session;
    return;
  }
  memorySession = null;
  await writeFile(
    TOKEN_FILE(),
    safeStorage.encryptString(JSON.stringify(session)),
    { mode: 0o600 },
  );
}

async function loadSession(): Promise<StoredGithubSession | null> {
  if (memorySession) return memorySession;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    return parseStoredSession(
      safeStorage.decryptString(await readFile(TOKEN_FILE())),
    );
  } catch {
    return null;
  }
}

async function clearSession() {
  memorySession = null;
  refreshInFlight = null;
  await rm(TOKEN_FILE(), { force: true });
}

function accessTokenStale(session: StoredGithubSession) {
  return (
    session.accessTokenExpiresAt !== null &&
    Date.now() >= session.accessTokenExpiresAt - EXPIRY_SKEW_MS
  );
}

function refreshTokenUsable(session: StoredGithubSession) {
  if (!session.refreshToken) return false;
  return (
    session.refreshTokenExpiresAt === null ||
    Date.now() < session.refreshTokenExpiresAt
  );
}

type RefreshResult =
  | { kind: "refreshed"; session: StoredGithubSession }
  | { kind: "offline" }
  | { kind: "rejected" };

async function refreshSession(
  session: StoredGithubSession,
): Promise<RefreshResult> {
  if (!refreshTokenUsable(session) || !session.refreshToken) {
    return { kind: "rejected" };
  }
  const body: Record<string, string> = {
    client_id: CLIENT_ID,
    grant_type: REFRESH_GRANT,
    refresh_token: session.refreshToken,
  };
  if (CLIENT_SECRET) body.client_secret = CLIENT_SECRET;

  let response: TokenResponse;
  try {
    response = await postForm<TokenResponse>(ACCESS_TOKEN_URL, body);
  } catch {
    return { kind: "offline" };
  }
  const next = sessionFromResponse(response, session);
  if (!next) return { kind: "rejected" };
  await saveSession(next);
  return { kind: "refreshed", session: next };
}

function refreshSessionOnce(session: StoredGithubSession) {
  refreshInFlight ??= refreshSession(session).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
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
export async function startDeviceFlow(): Promise<GithubDeviceFlowStart> {
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
export async function waitForAuthorization(): Promise<GithubSignInResult> {
  const flow = pending;
  if (!flow) return { ok: false, error: "cancelled" };

  try {
    while (Date.now() < flow.expiresAt) {
      await sleep(flow.interval * 1000, flow.abort.signal);

      let r: TokenResponse;
      try {
        r = await postForm<TokenResponse>(ACCESS_TOKEN_URL, {
          client_id: CLIENT_ID,
          device_code: flow.deviceCode,
          grant_type: DEVICE_GRANT,
        });
      } catch {
        // Transient network blip: keep polling until the code expires.
        continue;
      }

      const session = sessionFromResponse(r);
      if (session) {
        await saveSession(session);
        const result = await fetchUser(session.accessToken);
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

async function sessionForApi(): Promise<
  | { kind: "ready"; session: StoredGithubSession }
  | { kind: "offline"; user: GithubUser | null }
  | { kind: "signed-out" }
> {
  const stored = await loadSession();
  if (!stored) return { kind: "signed-out" };

  let session = stored;
  if (accessTokenStale(session)) {
    const refreshed = await refreshSessionOnce(session);
    if (refreshed.kind === "offline") {
      return { kind: "offline", user: cachedStatus?.user ?? null };
    }
    if (refreshed.kind === "rejected") {
      await clearSession();
      cachedStatus = null;
      return { kind: "signed-out" };
    }
    session = refreshed.session;
  }
  return { kind: "ready", session };
}

export async function getAuthStatus(): Promise<GithubAuthStatus> {
  if (cachedStatus?.signedIn && cachedStatus.user) {
    const stored = await loadSession();
    if (stored && !accessTokenStale(stored)) return cachedStatus;
  }

  const ready = await sessionForApi();
  if (ready.kind === "signed-out") {
    cachedStatus = null;
    return { signedIn: false, user: null };
  }
  if (ready.kind === "offline") {
    return { signedIn: true, user: ready.user };
  }

  let result = await fetchUser(ready.session.accessToken);
  if (result.kind === "unauthorized" && refreshTokenUsable(ready.session)) {
    const refreshed = await refreshSessionOnce(ready.session);
    if (refreshed.kind === "refreshed") {
      result = await fetchUser(refreshed.session.accessToken);
    } else if (refreshed.kind === "offline") {
      return { signedIn: true, user: cachedStatus?.user ?? null };
    }
  }
  if (result.kind === "unauthorized") {
    await clearSession();
    cachedStatus = null;
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
  await clearSession();
}
