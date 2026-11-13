import { describe, expect, it } from "vitest";
import { parseAuthUrl } from "./env";

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
    "/api/auth",
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
