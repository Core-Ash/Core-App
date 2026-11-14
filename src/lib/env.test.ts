import { describe, expect, it } from "vitest";
import { parseApiUrl, parseAuthUrl } from "./env";

describe("authentication URL configuration", () => {
  it("stays unconfigured without a URL", () => {
    expect(parseAuthUrl(undefined).url).toBeNull();
    expect(parseAuthUrl(" ").url).toBeNull();
  });
  it("supports HTTPS origins and custom auth paths", () => {
    expect(parseAuthUrl(" https://auth.example.com/ ").url).toBe(
      "https://auth.example.com",
    );
    expect(parseAuthUrl("https://auth.example.com/custom/auth").url).toBe(
      "https://auth.example.com/custom/auth",
    );
  });
  it("permits HTTP only on local development hosts", () => {
    expect(parseAuthUrl("http://localhost:3000").error).toBeNull();
    expect(parseAuthUrl("http://auth.example.com").url).toBeNull();
  });
  it.each([
    "//auth.example.com/api/auth",
    "javascript:alert(1)",
    "https://user:secret@example.com",
    "https://auth.example.com?secret=value",
    "https://auth.example.com#fragment",
  ])("rejects unsafe configuration: %s", (value) => {
    expect(parseAuthUrl(value).url).toBeNull();
  });
  it.each([
    "https://core-auth.railway.internal",
    "https://core-auth.railway.internal.",
    "https://railway.internal/api/auth",
  ])(
    "rejects a Railway private hostname in browser configuration: %s",
    (value) => {
      const configuration = parseAuthUrl(value);
      expect(configuration.url).toBeNull();
      expect(configuration.error).toContain("public HTTPS URL");
    },
  );
});

describe("Rust URL configuration", () => {
  it("requires explicit configuration and accepts the fixed same-origin paths", () => {
    expect(parseApiUrl(undefined).url).toBeNull();
    expect(parseApiUrl(" ").url).toBeNull();
    expect(parseApiUrl("/api/v1").url).toBe("/api/v1");
    expect(parseAuthUrl("/api/auth").url).toBe("/api/auth");
  });
  it("normalizes an origin to the documented versioned API base", () => {
    expect(parseApiUrl(" https://api.example.com/ ").url).toBe(
      "https://api.example.com/api/v1",
    );
    expect(parseApiUrl("https://api.example.com/api/v1/").url).toBe(
      "https://api.example.com/api/v1",
    );
    expect(parseApiUrl("http://localhost:3000").url).toBe(
      "http://localhost:3000/api/v1",
    );
  });
  it.each([
    "https://core.railway.internal",
    "http://api.example.com",
    "//api.example.com",
    "https://api.example.com/api/v2",
    "https://user:secret@api.example.com",
    "https://api.example.com?secret=value",
    "/api/auth",
  ])("rejects unsafe or unsupported API configuration: %s", (value) => {
    expect(parseApiUrl(value).url).toBeNull();
    expect(parseApiUrl(value).error).not.toContain("secret=value");
  });
  it("requires HTTPS for absolute production URLs, including localhost", () => {
    expect(parseApiUrl("http://localhost:3000", true).url).toBeNull();
    expect(parseAuthUrl("http://localhost:3001", true).url).toBeNull();
    expect(parseApiUrl("https://localhost:3000", true).url).toBeNull();
    expect(parseAuthUrl("https://192.168.1.1", true).url).toBeNull();
    expect(parseApiUrl("/api/v1", true).url).toBe("/api/v1");
  });
});
