// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseProxyOrigin, proxyServiceRequest } from "./service-proxy";

const env = {
  CORE_AUTH_PROXY_TARGET: "https://auth.example.com",
  CORE_API_PROXY_TARGET: "https://api.example.com",
};
afterEach(() => vi.unstubAllGlobals());

describe("same-origin service proxy", () => {
  it.each([
    [
      "/api/v1/channels/33333333-3333-4333-8333-333333333333/messages",
      "limit=50",
      "https://api.example.com",
    ],
    [
      "/api/v1/channels/33333333-3333-4333-8333-333333333333/messages",
      "limit=50&before_time=2026-11-16T10%3A00%3A00%2B00%3A00&before_id=44444444-4444-4444-8444-444444444444",
      "https://api.example.com",
    ],
    [
      "/api/v1/communities/22222222-2222-4222-8222-222222222222/channels/33333333-3333-4333-8333-333333333333/members",
      "search=Core+%26+friends&limit=50&after_id=44444444-4444-4444-8444-444444444444",
      "https://api.example.com",
    ],
    [
      "/api/v1/communities/22222222-2222-4222-8222-222222222222/channels/33333333-3333-4333-8333-333333333333/access",
      "limit=50&search=&role_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&access=denied",
      "https://api.example.com",
    ],
    [
      "/api/auth/get-session",
      "disableCookieCache=true&disableRefresh=true",
      "https://auth.example.com",
    ],
  ])("strips Vercel's rewrite capture while preserving API queries for %s", async (path, query, target) => {
    const upstream = vi.fn(async (input: string) => {
      // Rust's strict query extractors reject the extra routing parameter.
      return new URL(input).searchParams.has("path")
        ? Response.json({ code: "invalid_request" }, { status: 400 })
        : Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", upstream);
    const url = new URL(`https://core.example.com${path}?${query}`);
    url.searchParams.append("path", path.slice("/api/".length));
    // Routing metadata must never be allowed to choose the upstream URL.
    url.searchParams.append("path", "https://hostile.example.com");
    const response = await proxyServiceRequest(new Request(url), env);
    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0]![0]).toBe(`${target}${path}?${query}`);
  });
  it("preserves unrelated unknown query fields for backend validation", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ code: "invalid_request" }, { status: 400 }));
    vi.stubGlobal("fetch", upstream);
    const response = await proxyServiceRequest(
      new Request("https://core.example.com/api/v1/communities?path=v1%2Fcommunities&unexpected=1"), env,
    );
    expect(upstream.mock.calls[0]![0]).toBe("https://api.example.com/api/v1/communities?unexpected=1");
    expect(response.status).toBe(400);
  });
  it("preserves cookie scope and all auth cookies without caching", async () => {
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append(
      "Set-Cookie",
      "__Secure-better-auth.session_token=test; Path=/; HttpOnly; Secure; SameSite=Lax",
    );
    headers.append("Set-Cookie", "other=test; Path=/; HttpOnly; Secure");
    const request = vi
      .fn()
      .mockResolvedValue(new Response("null", { headers }));
    vi.stubGlobal("fetch", request);
    const response = await proxyServiceRequest(
      new Request("https://core.example.com/api/auth/get-session", {
        headers: {
          Cookie: "__Secure-better-auth.session_token=test",
          Origin: "https://core.example.com",
          Authorization: "Bearer untrusted",
          "X-Forwarded-For": "untrusted",
        },
      }),
      env,
    );
    const forwarded = request.mock.calls[0]![1].headers as Headers;
    expect(request.mock.calls[0]![0]).toBe(
      "https://auth.example.com/api/auth/get-session",
    );
    expect(forwarded.get("Cookie")).toBe(
      "__Secure-better-auth.session_token=test",
    );
    expect(forwarded.get("Origin")).toBe("https://core.example.com");
    expect(forwarded.has("Authorization")).toBe(false);
    expect(forwarded.has("X-Forwarded-For")).toBe(false);
    expect(response.headers.getSetCookie()).toEqual(headers.getSetCookie());
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("forwards browser Origin, cookie, CSRF, JSON and the full pagination query to Rust", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { ok: true },
          {
            headers: {
              "Retry-After": "9",
              "Server-Timing": "auth;dur=5.12, handler;dur=2.34",
              "Set-Cookie": "must-not-be-issued-by-rust=x",
            },
          },
        ),
      );
    vi.stubGlobal("fetch", request);
    const response = await proxyServiceRequest(
      new Request("https://core.example.com/api/v1/communities?limit=50", {
        method: "POST",
        headers: {
          Origin: "https://core.example.com",
          Cookie: "session=test",
          "Content-Type": "application/json",
          "X-Core-CSRF": "1",
        },
        body: '{"name":"Squad"}',
      }),
      env,
    );
    expect(request.mock.calls[0]![0]).toBe(
      "https://api.example.com/api/v1/communities?limit=50",
    );
    const options = request.mock.calls[0]![1];
    expect(options.headers.get("X-Core-CSRF")).toBe("1");
    expect(options.headers.get("Origin")).toBe("https://core.example.com");
    expect(new TextDecoder().decode(options.body)).toBe('{"name":"Squad"}');
    expect(response.headers.get("Retry-After")).toBe("9");
    expect(response.headers.has("Set-Cookie")).toBe(false);
    expect(response.headers.get("Server-Timing")).toBe("auth;dur=5.12, handler;dur=2.34");
  });
  it.each([
    undefined,
    "http://localhost:3000",
    "https://core.railway.internal",
    "https://user:secret@api.example.com",
    "https://api.example.com/path",
    "https://api.example.com?secret=value",
  ])(
    "rejects invalid upstream configuration without revealing it: %s",
    async (value) => {
      expect(() => parseProxyOrigin(value)).toThrow("public HTTPS origin");
      const request = vi.fn();
      vi.stubGlobal("fetch", request);
      const response = await proxyServiceRequest(
        new Request("https://core.example.com/api/v1/me"),
        { ...env, CORE_API_PROXY_TARGET: value },
      );
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("secret");
      expect(request).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, "https://hostile.example.com", "null"])(
    "rejects missing or cross-site write origins: %s",
    async (origin) => {
      const request = vi.fn();
      vi.stubGlobal("fetch", request);
      const response = await proxyServiceRequest(
        new Request("https://core.example.com/api/v1/me", {
          method: "POST",
          headers: origin ? { Origin: origin } : {},
        }),
        env,
      );
      expect(response.status).toBe(403);
      expect(request).not.toHaveBeenCalled();
    },
  );
  it("fails closed on redirects, unknown paths, oversized bodies, and upstream transport failure", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { Location: "https://evil.example.com" },
        }),
      );
    vi.stubGlobal("fetch", request);
    expect(
      (
        await proxyServiceRequest(
          new Request("https://core.example.com/api/auth/get-session"),
          env,
        )
      ).status,
    ).toBe(502);
    expect(request.mock.calls[0]![1].redirect).toBe("manual");
    expect(
      (
        await proxyServiceRequest(
          new Request("https://core.example.com/api/unknown"),
          env,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await proxyServiceRequest(
          new Request("https://core.example.com/api/v1/me", {
            method: "POST",
            headers: { Origin: "https://core.example.com" },
            body: "x".repeat(65537),
          }),
          env,
        )
      ).status,
    ).toBe(413);
    request.mockRejectedValue(new Error("private diagnostics"));
    const failed = await proxyServiceRequest(
      new Request("https://core.example.com/api/v1/me"),
      env,
    );
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("private diagnostics");
  });
});
