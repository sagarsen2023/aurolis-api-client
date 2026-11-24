import { net } from "electron";
import { getAccessToken, recoverFromUnauthorized } from "./github-auth.ts";
import type {
  GithubApiErrorCode,
  GithubApiErrorInfo,
} from "../src/types/github/github-error.type.ts";

const API_ORIGIN = "https://api.github.com";
const API_VERSION = "2022-11-28";
const MAX_PAGES = 20;

export class GithubApiError extends Error {
  readonly info: GithubApiErrorInfo;

  constructor(info: GithubApiErrorInfo) {
    super(info.message ?? info.code);
    this.name = "GithubApiError";
    this.info = info;
  }

  get code(): GithubApiErrorCode {
    return this.info.code;
  }
}

function apiUrl(endpointOrUrl: string) {
  const url = new URL(endpointOrUrl, API_ORIGIN);
  if (url.origin !== API_ORIGIN) {
    throw new GithubApiError({
      code: "invalid_input",
      message: `Refusing to call ${url.origin}`,
    });
  }
  return url.toString();
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageOf(body: unknown) {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return typeof body === "string" ? body.slice(0, 300) : undefined;
}

function toGithubApiError(response: Response, body: unknown): GithubApiError {
  const status = response.status;
  const message = messageOf(body);
  const lower = message?.toLowerCase() ?? "";

  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  const retryAfter = Number(response.headers.get("retry-after"));
  if ((status === 403 || status === 429) && (remaining === "0" || retryAfter)) {
    return new GithubApiError({
      code: "rate_limited",
      status,
      message,
      resetAt: retryAfter
        ? Date.now() + retryAfter * 1000
        : reset
          ? reset * 1000
          : undefined,
    });
  }

  let code: GithubApiErrorCode = "unknown";
  if (status === 401) code = "signed_out";
  else if (status === 403) code = "forbidden";
  else if (status === 404) code = "not_found";
  else if (status === 409)
    code = lower.includes("empty") ? "empty_repository" : "conflict";
  else if (status === 422)
    code = lower.includes("fast forward") ? "conflict" : "validation";
  else if (status === 413) code = "too_large";
  else if (status >= 500) code = "server";
  return new GithubApiError({ code, status, message });
}

type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
};

type RawResponse<T> = { data: T; headers: Headers };

async function send<T>(
  method: string,
  endpoint: string,
  options: RequestOptions,
): Promise<RawResponse<T>> {
  const url = apiUrl(endpoint);

  let auth = await getAccessToken();
  for (let attempt = 0; ; attempt++) {
    if (auth.kind === "offline") throw new GithubApiError({ code: "offline" });
    if (auth.kind === "signed-out") {
      throw new GithubApiError({ code: "signed_out" });
    }

    let response: Response;
    try {
      response = await net.fetch(url, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${auth.token}`,
          "X-GitHub-Api-Version": API_VERSION,
          ...(options.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...options.headers,
        },
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new GithubApiError({ code: "offline" });
    }

    if (response.status === 401 && attempt === 0) {
      auth = await recoverFromUnauthorized(auth.token);
      continue;
    }

    const body = await readBody(response);
    if (!response.ok) throw toGithubApiError(response, body);
    return { data: body as T, headers: response.headers };
  }
}

const request = async <T>(
  method: string,
  endpoint: string,
  options: RequestOptions = {},
) => (await send<T>(method, endpoint, options)).data;

function nextPageUrl(headers: Headers) {
  const link = headers.get("link");
  const match = link?.match(/<([^>]+)>;\s*rel="next"/);
  return match?.[1] ?? null;
}

interface EndpointParams {
  endpoint: string;
  options?: Omit<RequestOptions, "body">;
}

interface BodyParams extends EndpointParams {
  body: unknown;
}

const githubApi = {
  get: <T>({ endpoint, options }: EndpointParams) =>
    request<T>("GET", endpoint, options),
  post: <T>({ endpoint, body, options }: BodyParams) =>
    request<T>("POST", endpoint, { ...options, body }),
  put: <T>({ endpoint, body, options }: BodyParams) =>
    request<T>("PUT", endpoint, { ...options, body }),
  patch: <T>({ endpoint, body, options }: BodyParams) =>
    request<T>("PATCH", endpoint, { ...options, body }),
  delete: <T>({ endpoint, options }: EndpointParams) =>
    request<T>("DELETE", endpoint, options),

  getAll: async <Page, Item>({
    endpoint,
    pick,
    options,
  }: EndpointParams & { pick: (_page: Page) => Item[] }) => {
    const items: Item[] = [];
    let next: string | null = endpoint;
    for (let page = 0; next && page < MAX_PAGES; page++) {
      const { data, headers }: RawResponse<Page> = await send<Page>(
        "GET",
        next,
        options ?? {},
      );
      items.push(...pick(data));
      next = nextPageUrl(headers);
    }
    return items;
  },
};

export default githubApi;
