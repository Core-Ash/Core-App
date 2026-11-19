import { ApiError, responseError } from "@/lib/api/errors";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export interface RequestOptions {
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined>;
}

export function createApiClient({
  baseUrl,
  sessionSignal,
  isActive = () => true,
  onUnauthorized,
  credentials = "include",
}: {
  baseUrl: string | null;
  sessionSignal: () => AbortSignal;
  isActive?: () => boolean;
  onUnauthorized: () => Promise<"active" | "expired" | "unavailable">;
  credentials?: RequestCredentials;
}) {
  async function request<T>(
    method: Method,
    path: string,
    body?: Json,
    options: RequestOptions = {},
  ): Promise<T> {
    if (!baseUrl) throw new ApiError("configuration");
    if (!isActive()) throw new DOMException("Request cancelled", "AbortError");
    // Endpoint paths are source-owned. Never allow a path to replace the configured origin.
    if (!/^\/[a-zA-Z0-9/_-]*$/.test(path) || path.includes("//"))
      throw new ApiError("configuration");
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) params.set(key, String(value));
    }
    const query = params.size ? `?${params}` : "";
    const signal = AbortSignal.any([
      sessionSignal(),
      AbortSignal.timeout(25_000),
      ...(options.signal ? [options.signal] : []),
    ]);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (method !== "GET") headers["X-Core-CSRF"] = "1";

    try {
      const response = await fetch(`${baseUrl}${path}${query}`, {
        method,
        headers,
        credentials,
        referrerPolicy: "no-referrer",
        cache: "no-store",
        redirect: "error",
        signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      signal.throwIfAborted();
      if (!response.ok) {
        if (response.status === 401) {
          const state = await onUnauthorized();
          signal.throwIfAborted();
          throw new ApiError(
            state === "active"
              ? "session_transport"
              : state === "unavailable"
                ? "auth_unavailable"
                : "unauthorized",
            401,
          );
        }
        let code: string | null = null;
        try {
          const text = await response.text();
          if (text) {
            const parsed = JSON.parse(text) as { code?: unknown };
            if (typeof parsed?.code === "string") {
              code = parsed.code;
            }
          }
        } catch {
          // Ignore parse errors on error bodies; safe fallback code applies
        }
        signal.throwIfAborted();
        throw responseError(
          response.status,
          response.headers.get("Retry-After"),
          code,
        );
      }
      if (response.status === 204)
        return undefined as T;
      // Axum membership admission returns an empty 201, which may be chunked
      // by a proxy and therefore have no Content-Length header.
      const payload = await response.text();
      signal.throwIfAborted();
      if (!payload && method !== "GET") return undefined as T;
      if (
        !response.headers
          .get("Content-Type")
          ?.toLowerCase()
          .includes("application/json")
      ) {
        throw new ApiError("invalid_response", response.status);
      }
      let data: unknown;
      try {
        data = JSON.parse(payload);
      } catch {
        throw new ApiError("invalid_response", response.status);
      }
      signal.throwIfAborted();
      return data as T;
    } catch (error) {
      if (signal.aborted && signal.reason?.name !== "TimeoutError")
        throw signal.reason;
      if (error instanceof ApiError) throw error;
      throw new ApiError(signal.aborted ? "unavailable" : "network");
    }
  }
  return {
    get: <T>(path: string, options?: RequestOptions) =>
      request<T>("GET", path, undefined, options),
    post: <T>(path: string, body?: Json, options?: RequestOptions) =>
      request<T>("POST", path, body, options),
    put: <T>(path: string, body?: Json, options?: RequestOptions) =>
      request<T>("PUT", path, body, options),
    patch: <T>(path: string, body?: Json, options?: RequestOptions) =>
      request<T>("PATCH", path, body, options),
    delete: <T>(path: string, options?: RequestOptions) =>
      request<T>("DELETE", path, undefined, options),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
