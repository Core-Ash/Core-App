import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionFixture } from "@/test/auth-fixture";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./auth-context";
import { SessionGate } from "./SessionGate";

const harness = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: harness.useSession },
}));

function SessionStatus() {
  const { session, error } = useAuth();
  return (
    <p>
      {error
        ? "Session unavailable"
        : session
          ? session.user.name
          : "Signed out"}
    </p>
  );
}

describe("official session provider", () => {
  beforeEach(() => {
    harness.useSession.mockReturnValue({
      data: null,
      isPending: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("waits for startup restoration and then shows the session user", () => {
    harness.useSession.mockReturnValue({
      data: null,
      isPending: true,
      error: null,
      refetch: vi.fn(),
    });
    const view = render(
      <AuthProvider>
        <SessionGate>
          <SessionStatus />
        </SessionGate>
      </AuthProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Restoring your session",
    );
    harness.useSession.mockReturnValue({
      data: sessionFixture,
      isPending: false,
      error: null,
      refetch: vi.fn(),
    });
    view.rerender(
      <AuthProvider>
        <SessionGate>
          <SessionStatus />
        </SessionGate>
      </AuthProvider>,
    );
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
  });

  it("preserves an in-progress guest form during background session rechecks", () => {
    const form = (
      <AuthProvider>
        <SessionGate>
          <input aria-label="Draft name" />
        </SessionGate>
      </AuthProvider>
    );
    const view = render(form);
    fireEvent.change(screen.getByLabelText("Draft name"), {
      target: { value: "Alex" },
    });
    harness.useSession.mockReturnValue({
      data: null,
      isPending: true,
      error: null,
      refetch: vi.fn(),
    });
    view.rerender(
      <AuthProvider>
        <SessionGate>
          <input aria-label="Draft name" />
        </SessionGate>
      </AuthProvider>,
    );
    expect(screen.getByLabelText("Draft name")).toHaveValue("Alex");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("treats an expired unauthorized session as signed out", () => {
    harness.useSession.mockReturnValue({
      data: null,
      isPending: false,
      error: { status: 401 },
      refetch: vi.fn(),
    });
    render(
      <AuthProvider>
        <SessionStatus />
      </AuthProvider>,
    );
    expect(screen.getByText("Signed out")).toBeInTheDocument();
  });

  it("hides a stale session if the service fails to revalidate it", () => {
    harness.useSession.mockReturnValue({
      data: sessionFixture,
      isPending: false,
      error: { status: 503 },
      refetch: vi.fn(),
    });
    render(
      <AuthProvider>
        <SessionGate>
          <SessionStatus />
        </SessionGate>
      </AuthProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "couldn't check your session",
    );
    expect(screen.queryByText("Alex Morgan")).not.toBeInTheDocument();
  });
});
