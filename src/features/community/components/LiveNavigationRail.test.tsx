import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { LiveNavigationRail } from "@/features/community/components/LiveNavigationRail";
import type { ReactNode } from "react";

vi.mock("@/features/community/components/AddServerDialog", () => ({
  AddServerDialog: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/features/community/api/hooks", () => ({
  useCurrentUser: () => ({ isSuccess: false }),
}));
vi.mock("@/features/community/api/use-community-selection", () => ({
  useCommunitySelection: () => ({ communityItems: [], community: undefined }),
}));

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}
function setup(path = "/app") {
  render(<MemoryRouter initialEntries={[path]}><LiveNavigationRail /><Location /></MemoryRouter>);
  return screen.getByRole("link", { name: "Core Home" });
}

describe("Core Home navigation", () => {
  it("preserves the destination, tooltip and click navigation", () => {
    const home = setup();
    expect(home).toHaveAttribute("href", "/app/friends");
    expect(home).toHaveAttribute("title", "Friends and direct messages");
    expect(home).not.toHaveAttribute("aria-current");
    fireEvent.click(home);
    expect(screen.getByTestId("location")).toHaveTextContent("/app/friends");
    expect(home).toHaveAttribute("aria-current", "page");
    expect(home).toHaveClass("is-active");
  });

  it.each(["/app/friends", "/app/messages"])("keeps Home selected at %s", (path) => {
    expect(setup(path)).toHaveAttribute("aria-current", "page");
  });

  it("activates with Space and suppresses held-key repeats", () => {
    const home = setup();
    const click = vi.fn();
    home.addEventListener("click", click);
    fireEvent.keyDown(home, { key: " ", repeat: true });
    expect(click).not.toHaveBeenCalled();
    fireEvent.keyDown(home, { key: " " });
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location")).toHaveTextContent("/app/friends");
  });
});
