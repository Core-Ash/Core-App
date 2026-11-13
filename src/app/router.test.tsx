import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/auth-context";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";
import { AppRoutes } from "./router";

function LocationObserver() {
  const { pathname, search, hash, state } = useLocation();
  return (
    <div data-testid="location">
      {JSON.stringify({ path: pathname + search + hash, state })}
    </div>
  );
}

function renderRoutes(path: string, auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationObserver />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("authentication routing", () => {
  it("waits for the initial session check before showing protected content", () => {
    const view = renderRoutes("/app", { ...signedOutState, pending: true });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Restoring your session",
    );
    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
    view.unmount();
  });
  it("redirects signed-out users and preserves their intended destination", async () => {
    renderRoutes("/app?tab=home#top", signedOutState);
    expect(
      await screen.findByRole("heading", { name: "Welcome back." }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"from":"/app?tab=home#top"',
    );
  });
  it.each(["/login", "/register"])(
    "redirects signed-in users from %s to their home",
    async (path) => {
      renderRoutes(path, { ...signedOutState, session: sessionFixture });
      expect(
        await screen.findByRole("heading", { name: "Welcome back, Alex." }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("location")).toHaveTextContent('"path":"/app"');
    },
  );
  it("shows registration to signed-out users", () => {
    renderRoutes("/register", signedOutState);
    expect(
      screen.getByRole("heading", { name: "Create your account." }),
    ).toBeInTheDocument();
  });
  it("waits for session initialization before showing a guest registration form", () => {
    renderRoutes("/register", { ...signedOutState, pending: true });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Restoring your session",
    );
    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
  });
  it("preserves the destination when following the sign-up link", async () => {
    renderRoutes("/app?tab=home#top", signedOutState);
    fireEvent.click(await screen.findByRole("link", { name: "Sign up" }));
    expect(
      await screen.findByRole("heading", { name: "Create your account." }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"from":"/app?tab=home#top"',
    );
  });
  it.each([false, true])(
    "redirects the root according to session presence (%s)",
    async (signedIn) => {
      renderRoutes("/", {
        ...signedOutState,
        session: signedIn ? sessionFixture : null,
      });
      await waitFor(() =>
        expect(screen.getByTestId("location")).toHaveTextContent(
          `"path":"${signedIn ? "/app" : "/login"}"`,
        ),
      );
    },
  );
  it("hides protected content when session validation fails and supports retry", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    renderRoutes("/app", {
      ...signedOutState,
      session: sessionFixture,
      error: true,
      refresh,
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "couldn't check your session",
    );
    expect(screen.queryByText("Welcome back, Alex.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
  it("removes protected content when the session expires or is signed out", async () => {
    const view = renderRoutes("/app", {
      ...signedOutState,
      session: sessionFixture,
    });
    expect(
      screen.getByRole("heading", { name: "Welcome back, Alex." }),
    ).toBeInTheDocument();
    view.rerender(
      <AuthContext.Provider value={signedOutState}>
        <MemoryRouter initialEntries={["/app"]}>
          <AppRoutes />
          <LocationObserver />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Welcome back." }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Welcome back, Alex.")).not.toBeInTheDocument();
  });
  it("keeps the not-found page public", () => {
    renderRoutes("/missing", { ...signedOutState, pending: true });
    expect(
      screen.getByRole("heading", { name: "A little too far from home." }),
    ).toBeInTheDocument();
  });
});
