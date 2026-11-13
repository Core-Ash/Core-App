import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { AuthClient } from "@/lib/auth-client";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";
import { AuthContext, type AuthContextValue } from "./auth-context";
import { RegisterPage } from "./RegisterPage";

function renderRegistration(overrides: Partial<AuthContextValue> = {}) {
  const signUp = vi.fn().mockResolvedValue({
    data: { user: sessionFixture.user, token: null },
    error: null,
  });
  const getSession = vi.fn().mockResolvedValue({ data: null, error: null });
  const refresh = vi.fn().mockResolvedValue(undefined);
  const client = {
    signUp: { email: signUp },
    getSession,
  } as unknown as AuthClient;
  render(
    <AuthContext.Provider
      value={{ ...signedOutState, client, refresh, ...overrides }}
    >
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/app" element={<h1>Protected destination</h1>} />
          <Route path="/login" element={<h1>Sign in destination</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { signUp, getSession, refresh };
}

function fillRegistration(
  password = "a-long-password",
  confirmation = password,
) {
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), {
    target: { value: " Alex Morgan " },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: " alex@example.com " },
  });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm password", { exact: true }), {
    target: { value: confirmation },
  });
}

describe("registration form", () => {
  it("blocks invalid input and focuses the first invalid field", () => {
    const { signUp } = renderRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(screen.getByLabelText("Name", { exact: true })).toHaveFocus();
    expect(
      screen.getByLabelText("Name", { exact: true }),
    ).toHaveAccessibleDescription("Enter your name.");
    expect(signUp).not.toHaveBeenCalled();
  });
  it.each([
    ["too-short", "too-short", "Use at least 12 characters."],
    ["a-long-password", "different-password", "Passwords don't match."],
  ])(
    "blocks password violations before making a request: %s",
    (password, confirmation, message) => {
      const { signUp } = renderRegistration();
      fillRegistration(password, confirmation);
      fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(signUp).not.toHaveBeenCalled();
    },
  );
  it("uses the official sign-up API but does not assume it creates a session", async () => {
    const { signUp, getSession, refresh } = renderRegistration();
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(
      await screen.findByRole("heading", { name: "Registration received." }),
    ).toBeInTheDocument();
    expect(signUp).toHaveBeenCalledWith(
      {
        name: "Alex Morgan",
        email: "alex@example.com",
        password: "a-long-password",
      },
      { disableSignal: true },
    );
    expect(getSession).toHaveBeenCalledWith({
      query: { disableCookieCache: true },
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "Protected destination" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "If email verification is required",
    );
    expect(
      screen.queryByText(/email (has been|was) sent/i),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Continue to sign in" }));
    expect(
      await screen.findByRole("heading", { name: "Sign in destination" }),
    ).toBeInTheDocument();
  });
  it("enters the app only after the cookie-backed session is confirmed", async () => {
    const { getSession, refresh } = renderRegistration();
    getSession.mockResolvedValue({ data: sessionFixture, error: null });
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(
      await screen.findByRole("heading", { name: "Protected destination" }),
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("reports duplicate-email errors without echoing private server details", async () => {
    const { signUp, getSession } = renderRegistration();
    signUp.mockResolvedValue({
      error: {
        status: 422,
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        message: "private server detail",
      },
    });
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Try signing in instead",
    );
    expect(screen.queryByText("private server detail")).not.toBeInTheDocument();
    expect(getSession).not.toHaveBeenCalled();
  });
  it("handles a service-reported password policy error", async () => {
    const { signUp } = renderRegistration();
    signUp.mockResolvedValue({
      error: { status: 400, code: "PASSWORD_TOO_SHORT" },
    });
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "password doesn't meet",
    );
  });
  it("handles a network failure and re-enables the form", async () => {
    const { signUp } = renderRegistration();
    signUp.mockRejectedValue(new TypeError("Failed to fetch"));
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your connection",
    );
    expect(screen.getByRole("button", { name: "Sign up" })).toBeEnabled();
  });
  it("offers session retry without repeating account creation", async () => {
    const { signUp, getSession, refresh } = renderRegistration();
    getSession
      .mockResolvedValueOnce({ data: null, error: { status: 503 } })
      .mockResolvedValueOnce({ data: sessionFixture, error: null });
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(
      await screen.findByRole("heading", { name: "Registration received." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "couldn't check your sign-in session",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Check session again" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Protected destination" }),
    ).toBeInTheDocument();
    expect(signUp).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("disables duplicate submissions while the request is pending", async () => {
    const { signUp } = renderRegistration();
    let finish: (value: unknown) => void = () => {};
    signUp.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(
      screen.getByRole("button", { name: "Creating account…" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Name", { exact: true })).toBeDisabled();
    finish({ error: { status: 503 } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign up" })).toBeEnabled(),
    );
    expect(signUp).toHaveBeenCalledOnce();
  });
  it("responds to sign-up with a configuration error instead of a disabled button when no service is configured", () => {
    const { signUp, getSession, refresh } = renderRegistration({
      client: null,
      configurationError: "Set VITE_AUTH_URL to connect Core-auth.",
    });
    const button = screen.getByRole("button", { name: "Sign up" });
    expect(button).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Set VITE_AUTH_URL");
    fillRegistration();
    fireEvent.click(button);
    expect(screen.getByRole("alert")).toHaveTextContent("Set VITE_AUTH_URL");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(button).toBeEnabled();
  });
});
