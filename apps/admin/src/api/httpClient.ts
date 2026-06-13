export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type HttpRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: HeadersInit;
};

export type ApiErrorPayload = {
  code?: string;
  message?: string;
  requestId?: string;
  details?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly details: unknown;

  constructor(input: {
    status: number;
    code?: string;
    message?: string;
    requestId?: string | null;
    details?: unknown;
  }) {
    super(input.message ?? "Request failed.");
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code ?? "HTTP_ERROR";
    this.requestId = input.requestId ?? null;
    this.details = input.details;
  }
}

const authTokenStorageKey = "liax.admin.authToken";

function readApiBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
  const explicitValue = typeof env?.VITE_API_BASE_URL === "string" ? env.VITE_API_BASE_URL : "";
  const value = explicitValue || (env?.DEV === true ? "http://127.0.0.1:3000" : "");
  return value.replace(/\/$/, "");
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export function buildApiUrl(path: string): string {
  return joinUrl(readApiBaseUrl(), path);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readErrorPayload(value: unknown): ApiErrorPayload {
  if (!isPlainObject(value)) {
    return {};
  }

  const source = isPlainObject(value.error) ? value.error : value;

  return {
    code: typeof source.code === "string" ? source.code : undefined,
    details: source.details,
    message: typeof source.message === "string" ? source.message : undefined,
    requestId: typeof source.requestId === "string" ? source.requestId : undefined
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? { message: text } : null;
}

export function readAuthToken(): string | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    return window.localStorage.getItem(authTokenStorageKey);
  } catch {
    return null;
  }
}

export function writeAuthToken(token: string): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(authTokenStorageKey, token);
  } catch {
    // Token persistence can fail in restricted browser storage modes.
  }
}

export function clearAuthToken(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(authTokenStorageKey);
  } catch {
    // Token persistence can fail in restricted browser storage modes.
  }
}

export async function httpRequest<TResponse>(
  path: string,
  options: HttpRequestOptions = {}
): Promise<TResponse> {
  const headers = new Headers(options.headers);
  const token = readAuthToken();
  let body: BodyInit | undefined;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      body = options.body;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }
  }

  const response = await fetch(joinUrl(readApiBaseUrl(), path), {
    body,
    headers,
    method: options.method ?? "GET"
  });
  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    const payload = readErrorPayload(responseBody);

    throw new ApiError({
      code: payload.code,
      details: payload.details,
      message: payload.message,
      requestId: payload.requestId ?? response.headers.get("x-request-id"),
      status: response.status
    });
  }

  return responseBody as TResponse;
}

export const httpClient = {
  delete<TResponse>(path: string, body?: unknown, options?: Omit<HttpRequestOptions, "method" | "body">): Promise<TResponse> {
    return httpRequest<TResponse>(path, { ...options, body, method: "DELETE" });
  },
  get<TResponse>(path: string, options?: Omit<HttpRequestOptions, "method" | "body">): Promise<TResponse> {
    return httpRequest<TResponse>(path, { ...options, method: "GET" });
  },
  patch<TResponse>(path: string, body?: unknown, options?: Omit<HttpRequestOptions, "method" | "body">): Promise<TResponse> {
    return httpRequest<TResponse>(path, { ...options, body, method: "PATCH" });
  },
  post<TResponse>(path: string, body?: unknown, options?: Omit<HttpRequestOptions, "method" | "body">): Promise<TResponse> {
    return httpRequest<TResponse>(path, { ...options, body, method: "POST" });
  }
};
