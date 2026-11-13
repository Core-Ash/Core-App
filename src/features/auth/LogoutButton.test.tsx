import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { AuthClient } from "@/lib/auth-client";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";
import { AuthContext } from "./auth-context";
import { LogoutButton } from "./LogoutButton";

function renderLogout() {
  const signOut = vi
    .fn()
    .mockResolvedValue({ data: { success: true }, error: null });
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(
    <AuthContext.Provider
      value={{
        ...signedOutState,
        session: sessionFixture,
        client: { signOut } as unknown as AuthClient,
        refresh,
      }}
    >
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route path="/app" element={<LogoutButton />} />
          <Route path="/login" element={<h1>Signed out</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { signOut, refresh };
}

describe("logout", () => {
  it("refreshes the official session and navigates only after successful sign-out", async () => {
    const { signOut, refresh } = renderLogout();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(
      await screen.findByRole("heading", { name: "Signed out" }),
    ).toBeInTheDocument();
    expect(signOut).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("keeps the action available when the service rejects sign-out", async () => {
    const { signOut, refresh } = renderLogout();
    signOut.mockResolvedValue({ error: { status: 500 } });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't sign out",
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
