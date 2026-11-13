import { describe, expect, it } from "vitest";
import { signInErrorMessage, validateLogin } from "./login-validation";
import { getReturnPath } from "./return-path";

describe("login validation", () => {
  it("requires an email and a password", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
  });
  it("rejects malformed email addresses", () => {
    expect(
      validateLogin({ email: "not-an-email", password: "password" }).email,
    ).toBeTruthy();
  });
  it("trims emails without imposing a sign-up policy on existing passwords", () => {
    expect(
      validateLogin({ email: " person@example.com ", password: " x " }),
    ).toEqual({});
  });
  it("shows a generic credential error without echoing server details", () => {
    expect(signInErrorMessage({ status: 401 })).toContain(
      "Check your email and password",
    );
    expect(signInErrorMessage({ status: 429 })).toContain(
      "Too many sign-in attempts",
    );
  });
});

describe("post-login destination", () => {
  it("preserves an app destination including search and hash", () => {
    expect(getReturnPath({ from: "/app?tab=home#top" })).toBe(
      "/app?tab=home#top",
    );
  });
  it.each([
    undefined,
    null,
    { from: "https://example.com" },
    { from: "//example.com" },
    { from: "/login" },
    { from: "/application" },
    { from: "/app\\evil" },
  ])("rejects invalid destinations: %j", (state) => {
    expect(getReturnPath(state)).toBe("/app");
  });
});
