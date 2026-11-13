import { describe, expect, it } from "vitest";
import { getDevAuthProxyHttps, getDevAuthProxyTarget } from "./dev-auth-proxy";

describe("development auth proxy configuration", () => {
  it("defaults to local HTTPS and requires an explicit opt-out for localhost HTTP", () => {
    expect(getDevAuthProxyHttps(undefined)).toBe(true);
    expect(getDevAuthProxyHttps("")).toBe(true);
    expect(getDevAuthProxyHttps("true")).toBe(true);
    expect(getDevAuthProxyHttps("false")).toBe(false);
    expect(() => getDevAuthProxyHttps("off")).toThrow("must be true or false");
  });
  it("leaves the proxy disabled unless explicitly configured", () => {
    expect(getDevAuthProxyTarget(undefined)).toBeUndefined();
    expect(getDevAuthProxyTarget(" ")).toBeUndefined();
  });

  it("accepts an HTTPS upstream origin", () => {
    expect(getDevAuthProxyTarget(" https://auth.example.com/ ")).toBe(
      "https://auth.example.com",
    );
  });

  it.each([
    "http://auth.example.com",
    "https://auth.example.com/api/auth",
    "https://auth.example.com?key=value",
    "https://auth.example.com#fragment",
    "/api/auth",
  ])("rejects an unsafe or ambiguous target: %s", (value) => {
    expect(() => getDevAuthProxyTarget(value)).toThrow(
      "must be an HTTPS origin",
    );
  });

  it("does not echo credentials when rejecting a URL", () => {
    try {
      getDevAuthProxyTarget(
        "https://person:sensitive-password@auth.example.com",
      );
      throw new Error("Expected invalid configuration to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain("sensitive-password");
      expect((error as Error).message).toContain("must be an HTTPS origin");
    }
  });
});
