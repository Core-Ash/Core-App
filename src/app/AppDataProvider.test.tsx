import { StrictMode, useEffect, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataProvider } from "@/app/AppDataProvider";
import { useAppData } from "@/app/app-data-context";
import { ApiNotice } from "@/components/common/ApiNotice";
import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/auth-context";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { useCurrentUser } from "@/features/community/api/hooks";
import type { AuthClient } from "@/lib/auth-client";
import { profileFixture } from "@/test/api-fixtures";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";

vi.mock("@/lib/env", () => ({
  apiConfiguration: { url: "/api/v1", configured: true, error: null },
}));
afterEach(() => vi.unstubAllGlobals());

let capturedQueries: QueryClient;
function ProfileProbe() {
  const profile = useCurrentUser();
  const data = useAppData();
  const queries = useQueryClient();
  useEffect(() => {
    capturedQueries = queries;
  }, [queries]);
  return (
    <>
      <p>
        {profile.isSuccess ? profile.data.display_name : "No private profile"}
      </p>
      {profile.error && <ApiNotice error={profile.error} />}
      <button
        onClick={() => {
          void data.api.get("/me").catch(() => {});
        }}
      >
        Direct request
      </button>
    </>
  );
}
function wrapper(
  auth: AuthContextValue,
  children: ReactNode = <ProfileProbe />,
) {
  return (
    <AuthContext.Provider value={auth}>
      <AppDataProvider>{children}</AppDataProvider>
    </AuthContext.Provider>
  );
}
function authenticated(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return { ...signedOutState, session: sessionFixture, ...overrides };
}

describe("session-scoped application data", () => {
  it.each([
    { ...signedOutState },
    { ...signedOutState, pending: true },
    authenticated({ error: true }),
  ])(
    "blocks protected transport while signed out, initializing, or unable to verify auth",
    async (auth) => {
      const request = vi.fn();
      vi.stubGlobal("fetch", request);
      render(wrapper(auth));
      fireEvent.click(screen.getByRole("button", { name: "Direct request" }));
      await act(async () => {});
      expect(request).not.toHaveBeenCalled();
    },
  );
  it("deduplicates profile observers and works with StrictMode effect replay", async () => {
    const request = vi
      .fn()
      .mockImplementation(async () => Response.json({ profile: profileFixture, communities: { items: [] } }));
    vi.stubGlobal("fetch", request);
    render(
      <StrictMode>
        {wrapper(
          authenticated(),
          <>
            <ProfileProbe />
            <ProfileProbe />
          </>,
        )}
      </StrictMode>,
    );
    await waitFor(() =>
      expect(screen.getAllByText(profileFixture.display_name)).toHaveLength(2),
    );
    // StrictMode may cancel its initial request, but it must not duplicate a committed observer's fetch.
    expect(
      request.mock.calls.filter(
        (call) => !(call[1].signal as AbortSignal).aborted,
      ),
    ).toHaveLength(1);
  });
  it("isolates account switches, aborts old reads, and ignores late private responses", async () => {
    let finishFirst!: (response: Response) => void;
    const request = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          finishFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ profile: { ...profileFixture, display_name: "Second account" }, communities: { items: [] } }),
      );
    vi.stubGlobal("fetch", request);
    const view = render(wrapper(authenticated()));
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    const oldQueries = capturedQueries;
    oldQueries.setQueryData(["private-extra"], { oldAccount: true });
    const secondSession = {
      ...sessionFixture,
      user: { ...sessionFixture.user, id: "second-user" },
      session: {
        ...sessionFixture.session,
        id: "second-session",
        userId: "second-user",
      },
    };
    view.rerender(wrapper(authenticated({ session: secondSession })));
    expect((request.mock.calls[0]![1].signal as AbortSignal).aborted).toBe(
      true,
    );
    expect(oldQueries.getQueryCache().getAll()).toHaveLength(0);
    expect(await screen.findByText("Second account")).toBeInTheDocument();
    await act(async () => {
      finishFirst(Response.json({ profile: profileFixture, communities: { items: [] } }));
    });
    expect(
      screen.queryByText(profileFixture.display_name),
    ).not.toBeInTheDocument();
    expect(oldQueries.getQueryCache().getAll()).toHaveLength(0);
    expect(capturedQueries).not.toBe(oldQueries);
  });
  it("clears the previous cache when a session expires", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ profile: profileFixture, communities: { items: [] } })),
    );
    const view = render(wrapper(authenticated()));
    await screen.findByText(profileFixture.display_name);
    const oldQueries = capturedQueries;
    view.rerender(wrapper(signedOutState));
    expect(
      screen.queryByText(profileFixture.display_name),
    ).not.toBeInTheDocument();
    expect(oldQueries.getQueryCache().getAll()).toHaveLength(0);
  });
  it("clears private memory immediately after successful official sign-out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ profile: profileFixture, communities: { items: [] } })),
    );
    const refresh = vi.fn().mockResolvedValue(undefined);
    const signOut = vi
      .fn()
      .mockResolvedValue({ data: { success: true }, error: null });
    render(
      wrapper(
        authenticated({
          refresh,
          client: { signOut } as unknown as AuthClient,
        }),
        <MemoryRouter initialEntries={["/app"]}>
          <Routes>
            <Route
              path="/app"
              element={
                <>
                  <ProfileProbe />
                  <LogoutButton />
                </>
              }
            />
            <Route path="/login" element={<p>Signed out destination</p>} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    await screen.findByText(profileFixture.display_name);
    const oldQueries = capturedQueries;
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByText("Signed out destination");
    expect(
      oldQueries
        .getQueryCache()
        .getAll()
        .every((query) => query.state.data === undefined),
    ).toBe(true);
    expect(oldQueries.getMutationCache().getAll()).toHaveLength(0);
    expect(refresh).toHaveBeenCalledOnce();
  });
  it.each([
    [sessionFixture, null, "Your sign-in is active"],
    [null, null, "Your session has ended"],
    [
      null,
      { status: 503 },
      "authentication service may be temporarily unavailable",
    ],
  ])(
    "rechecks a Rust 401 with the official Better Auth session API",
    async (confirmed, error, message) => {
      const request = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 401 }));
      const getSession = vi.fn().mockResolvedValue({ data: confirmed, error });
      const refresh = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("fetch", request);
      render(
        wrapper(
          authenticated({
            refresh,
            client: { getSession } as unknown as AuthClient,
          }),
        ),
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        String(message),
      );
      expect(getSession).toHaveBeenCalledExactlyOnceWith({
        query: { disableCookieCache: true },
      });
      expect(request).toHaveBeenCalledOnce();
      if (confirmed) expect(refresh).not.toHaveBeenCalled();
    },
  );
  it("does not check or end the auth session on Rust 403", async () => {
    const getSession = vi.fn();
    const signOut = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );
    render(
      wrapper(
        authenticated({
          client: { getSession, signOut } as unknown as AuthClient,
        }),
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "don't have permission",
    );
    expect(getSession).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
