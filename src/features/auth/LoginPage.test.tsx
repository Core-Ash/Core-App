import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { AuthClient } from "@/lib/auth-client";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";
import { AuthContext, type AuthContextValue } from "./auth-context";
import { LoginPage } from "./LoginPage";

function Destination() {
  const location = useLocation();
  return (
    <p>Arrived at {location.pathname + location.search + location.hash}</p>
  );
}

function renderLogin(overrides: Partial<AuthContextValue> = {}) {
  const signIn = vi.fn().mockResolvedValue({ data: null, error: null });
  const getSession = vi
    .fn()
    .mockResolvedValue({ data: sessionFixture, error: null });
  const refresh = vi.fn().mockResolvedValue(undefined);
  const client = {
    signIn: { email: signIn },
    getSession,
  } as unknown as AuthClient;
  render(
    <AuthContext.Provider
      value={{ ...signedOutState, client, refresh, ...overrides }}
    >
      <MemoryRouter
        initialEntries={[
          { pathname: "/login", state: { from: "/app?view=home#top" } },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { signIn, getSession, refresh };
}

function fillCredentials() {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: " alex@example.com " },
  });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
    target: { value: "test-password" },
  });
}

describe("login form", () => {
  it("shows accessible validation errors and focuses the first invalid field", () => {
    const { signIn } = renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByLabelText("Email address")).toHaveFocus();
    expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(
      "Enter your email address.",
    );
    expect(
      screen.getByLabelText("Password", { exact: true }),
    ).toHaveAccessibleDescription("Enter your password.");
    expect(signIn).not.toHaveBeenCalled();
  });
  it("toggles password visibility without submitting", () => {
    const { signIn } = renderLogin();
    const password = screen.getByLabelText("Password", { exact: true });
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(signIn).not.toHaveBeenCalled();
  });
  it("calls the official client API and refreshes the session before returning to the destination", async () => {
    const { signIn, getSession, refresh } = renderLogin();
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText("Arrived at /app?view=home#top"),
    ).toBeInTheDocument();
    expect(signIn).toHaveBeenCalledWith(
      {
        email: "alex@example.com",
        password: "test-password",
        rememberMe: true,
      },
      { disableSignal: true },
    );
    expect(getSession).toHaveBeenCalledWith({
      query: { disableCookieCache: true },
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(signIn.mock.invocationCallOrder[0]).toBeLessThan(
      refresh.mock.invocationCallOrder[0]!,
    );
  });
  it("shows safe credential errors without navigating or echoing server details", async () => {
    const { signIn, refresh } = renderLogin();
    signIn.mockResolvedValue({
      error: { status: 401, message: "sensitive server detail" },
    });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your email and password",
    );
    expect(
      screen.queryByText("sensitive server detail"),
    ).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
  it("recovers from a network failure", async () => {
    const { signIn } = renderLogin();
    signIn.mockRejectedValue(new TypeError("Failed to fetch"));
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your connection",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
  it("disables duplicate submissions while awaiting the service", async () => {
    const { signIn } = renderLogin();
    let finish: (value: unknown) => void = () => {};
    signIn.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(screen.getByLabelText("Email address")).toBeDisabled();
    finish({ error: { status: 401 } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(),
    );
    expect(signIn).toHaveBeenCalledOnce();
  });
  it("responds to sign-in with a configuration error instead of a disabled button when no service is configured", () => {
    const { signIn, getSession, refresh } = renderLogin({
      client: null,
      configurationError: "Set VITE_AUTH_URL before signing in.",
    });
    expect(screen.getByRole("status")).toHaveTextContent("Set VITE_AUTH_URL");
    const button = screen.getByRole("button", { name: "Sign in" });
    expect(button).toBeEnabled();
    fillCredentials();
    fireEvent.click(button);
    expect(screen.getByRole("alert")).toHaveTextContent("Set VITE_AUTH_URL");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(button).toBeEnabled();
  });
  it("does not enter the app when the service accepts sign-in but the cookie is missing", async () => {
    const { getSession, refresh } = renderLogin();
    getSession.mockResolvedValue({ data: null, error: null });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Allow cookies");
    expect(screen.queryByText(/Arrived at/)).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
  it("does not treat a session service failure as a confirmed login", async () => {
    const { getSession, refresh } = renderLogin();
    getSession.mockResolvedValue({
      data: null,
      error: { status: 503, message: "private detail" },
    });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "couldn't confirm your session",
    );
    expect(screen.queryByText(/Arrived at/)).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
