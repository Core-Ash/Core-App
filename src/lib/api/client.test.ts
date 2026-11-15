// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/errors";
import { SessionScope } from "@/lib/api/session-scope";

afterEach(() => vi.unstubAllGlobals());
function setup(state: "active" | "expired" | "unavailable" = "active") {
  const controller = new AbortController();
  const recheck = vi.fn().mockResolvedValue(state);
  const request = vi
    .fn()
    .mockImplementation(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", request);
  const api = createApiClient({
    baseUrl: "https://api.example.com/api/v1",
    sessionSignal: () => controller.signal,
    onUnauthorized: recheck,
  });
  return { api, request, controller, recheck };
}

describe("Rust API transport", () => {
  it("uses credentials, JSON, no-store, cancellation, and the documented CSRF header", async () => {
    const { api, request } = setup();
    await api.get("/me", {
      query: {
        before_time: "2026-11-15T10:00:00+00:00",
        limit: 50,
        absent: undefined,
      },
    });
    expect(request).toHaveBeenLastCalledWith(
      "https://api.example.com/api/v1/me?before_time=2026-11-15T10%3A00%3A00%2B00%3A00&limit=50",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal: expect.any(AbortSignal),
        headers: { Accept: "application/json" },
      }),
    );
    for (const method of ["post", "put", "patch"] as const) {
      await api[method]("/communities", { name: "Squad" });
      expect(request).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: method.toUpperCase(),
          body: '{"name":"Squad"}',
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Core-CSRF": "1",
          },
        }),
      );
    }
    await api.delete("/communities");
    expect(request).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "DELETE",
        headers: { Accept: "application/json", "X-Core-CSRF": "1" },
      }),
    );
  });
  it.each([
    [403, "forbidden"],
    [404, "not_found"],
    [429, "rate_limited"],
    [400, "validation"],
    [422, "validation"],
    [409, "conflict"],
    [500, "unavailable"],
    [503, "unavailable"],
  ])(
    "maps HTTP %s without exposing the response body",
    async (status, kind) => {
      const { api, request, recheck } = setup();
      request.mockResolvedValue(
        Response.json(
          { error: "sensitive server details" },
          { status: Number(status), headers: { "Retry-After": "7" } },
        ),
      );
      await expect(api.get("/me")).rejects.toMatchObject({ kind, status });
      await expect(api.get("/me")).rejects.not.toHaveProperty(
        "message",
        expect.stringContaining("sensitive"),
      );
      expect(recheck).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["active", "session_transport"],
    ["expired", "unauthorized"],
    ["unavailable", "auth_unavailable"],
  ] as const)(
    "rechecks 401 once without retrying when auth is %s",
    async (state, kind) => {
      const { api, request, recheck } = setup(state);
      request.mockResolvedValue(new Response(null, { status: 401 }));
      await expect(api.get("/me")).rejects.toMatchObject({ kind, status: 401 });
      expect(request).toHaveBeenCalledOnce();
      expect(recheck).toHaveBeenCalledOnce();
    },
  );
  it("maps a network failure and rate limit delay", async () => {
    const { api, request } = setup();
    request.mockRejectedValueOnce(new TypeError("private network diagnostics"));
    await expect(api.get("/me")).rejects.toMatchObject({ kind: "network" });
    request.mockResolvedValue(
      new Response(null, { status: 429, headers: { "Retry-After": "12" } }),
    );
    await expect(api.get("/me")).rejects.toMatchObject({ retryAfter: 12 });
  });
  it("accepts empty 204 responses but rejects HTML, malformed JSON, and invalid typed payloads", async () => {
    const { api, request } = setup();
    request.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api.delete("/me")).resolves.toBeUndefined();
    request.mockResolvedValueOnce(
      new Response("<html>login</html>", {
        headers: { "Content-Type": "text/html" },
      }),
    );
    await expect(api.get("/me")).rejects.toMatchObject({
      kind: "invalid_response",
    });
    request.mockResolvedValueOnce(
      new Response("{", { headers: { "Content-Type": "application/json" } }),
    );
    await expect(api.get("/me")).rejects.toMatchObject({
      kind: "invalid_response",
    });
    request.mockResolvedValueOnce(
      Response.json({ id: "not-a-uuid", username: "member" }),
    );
    await expect(endpoints.currentUser(api)).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });
  it("refuses unconfigured requests and paths that could escape the service base", async () => {
    const { request, controller, recheck } = setup();
    const api = createApiClient({
      baseUrl: null,
      sessionSignal: () => controller.signal,
      onUnauthorized: recheck,
    });
    await expect(api.get("/me")).rejects.toBeInstanceOf(ApiError);
    const configured = setup().api;
    for (const path of [
      "//evil.example",
      "/../me",
      "https://evil.example",
      "/me?token=secret",
    ])
      await expect(configured.get(path)).rejects.toMatchObject({
        kind: "configuration",
      });
    expect(request).not.toHaveBeenCalled();
  });
  it("accepts the bodyless membership 201 with or without Content-Length", async () => {
    const { api, request } = setup();
    for (const headers of [new Headers(), new Headers({ "Content-Length": "0" })]) {
      request.mockResolvedValueOnce(new Response(null, { status: 201, headers }));
      await expect(endpoints.addMember(api,
        "22222222-2222-4222-8222-222222222222",
        "11111111-1111-4111-8111-111111111111",
      )).resolves.toBeUndefined();
      expect(request).toHaveBeenLastCalledWith(
        "https://api.example.com/api/v1/communities/22222222-2222-4222-8222-222222222222/members",
        expect.objectContaining({ method: "POST", credentials: "include",
          body: '{"user_id":"11111111-1111-4111-8111-111111111111"}',
          headers: expect.objectContaining({ "X-Core-CSRF": "1" }),
        }),
      );
    }
  });
  it("rejects an empty read response even if Content-Length says zero", async () => {
    const { api, request } = setup();
    request.mockResolvedValue(new Response(null, { headers: { "Content-Length": "0" } }));
    await expect(endpoints.currentUser(api)).rejects.toMatchObject({ kind: "invalid_response" });
  });
  it("discards a late response after caller cancellation", async () => {
    const { api, request } = setup();
    const controller = new AbortController();
    let finish!: (response: Response) => void;
    request.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    const result = api.get("/me", { signal: controller.signal });
    controller.abort();
    finish(Response.json({ private: "old account" }));
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
  it("clears query and mutation data, cancels in-flight writes, and blocks further requests on logout", async () => {
    const { request } = setup();
    const scope = new SessionScope("/api/v1", async () => "active");
    scope.queries.setQueryData(["profile"], { private: true });
    scope.queries
      .getMutationCache()
      .build(
        scope.queries,
        {},
        {
          data: { private: true },
          error: null,
          failureCount: 0,
          failureReason: null,
          isPaused: false,
          status: "success",
          variables: undefined,
          context: undefined,
          submittedAt: 0,
        },
      );
    let finish!: (response: Response) => void;
    request.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    const result = scope.api.post("/me", {});
    const signal = request.mock.calls[0]![1].signal as AbortSignal;
    scope.clear();
    expect(signal.aborted).toBe(true);
    expect(scope.queries.getQueryCache().getAll()).toHaveLength(0);
    expect(scope.queries.getMutationCache().getAll()).toHaveLength(0);
    finish(Response.json({ private: true }));
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    await expect(scope.api.get("/me")).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(request).toHaveBeenCalledOnce();
  });
});
