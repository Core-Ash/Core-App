import { describe, expect, it } from "vitest";
import {
  signUpErrorMessage,
  validateRegistration,
  type RegisterValues,
} from "./register-validation";

const validValues: RegisterValues = {
  name: "Alex Morgan",
  email: "alex@example.com",
  password: "a-long-password",
  confirmPassword: "a-long-password",
};

describe("Core-auth registration validation", () => {
  it("requires all fields", () => {
    expect(
      validateRegistration({
        name: " ",
        email: "",
        password: "",
        confirmPassword: "",
      }),
    ).toEqual({
      name: "Enter your name.",
      email: "Enter your email address.",
      password: "Enter your password.",
      confirmPassword: "Confirm your password.",
    });
  });
  it("accepts a valid name, email, and matching passwords", () => {
    expect(
      validateRegistration({
        ...validValues,
        name: " Alex Morgan ",
        email: " alex@example.com ",
      }),
    ).toEqual({});
  });
  it("rejects malformed email", () => {
    expect(
      validateRegistration({ ...validValues, email: "not-an-email" }).email,
    ).toBeTruthy();
  });
  it("enforces Core-auth's 12-character minimum, including at the boundary", () => {
    expect(
      validateRegistration({
        ...validValues,
        password: "a".repeat(11),
        confirmPassword: "a".repeat(11),
      }).password,
    ).toContain("at least 12");
    expect(
      validateRegistration({
        ...validValues,
        password: "a".repeat(12),
        confirmPassword: "a".repeat(12),
      }),
    ).toEqual({});
  });
  it("enforces the 128-character maximum", () => {
    expect(
      validateRegistration({
        ...validValues,
        password: "a".repeat(129),
        confirmPassword: "a".repeat(129),
      }).password,
    ).toContain("no more than 128");
    expect(
      validateRegistration({
        ...validValues,
        password: "a".repeat(128),
        confirmPassword: "a".repeat(128),
      }),
    ).toEqual({});
  });
  it("compares passwords exactly without trimming them", () => {
    expect(
      validateRegistration({
        ...validValues,
        confirmPassword: validValues.password + " ",
      }).confirmPassword,
    ).toBe("Passwords don't match.");
  });
  it.each(["USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"])(
    "handles the duplicate-email code %s",
    (code) => {
      expect(signUpErrorMessage({ code })).toContain("Try signing in instead");
    },
  );
  it("handles policy, rate limit, and service failures without raw server messages", () => {
    expect(signUpErrorMessage({ code: "PASSWORD_TOO_SHORT" })).toContain(
      "password doesn't meet",
    );
    expect(signUpErrorMessage({ status: 429 })).toContain("Too many attempts");
    expect(signUpErrorMessage({ status: 503 })).toContain(
      "temporarily unavailable",
    );
  });
});
