// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseProxyOrigin, proxyServiceRequest } from "./service-proxy";

const env = {
  CORE_AUTH_PROXY_TARGET: "https://auth.example.com",
  CORE_API_PROXY_TARGET: "https://api.example.com",
};
afterEach(() => vi.unstubAllGlobals());

describe("same-origin service proxy", () => {
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
