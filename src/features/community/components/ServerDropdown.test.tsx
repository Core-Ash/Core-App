import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataProvider } from "@/app/AppDataProvider";
import { AuthContext } from "@/features/auth/auth-context";
import { signedOutState, sessionFixture } from "@/test/auth-fixture";
import { channelFixture, communityFixture } from "@/test/api-fixtures";
import { ServerDropdown } from "@/features/community/components/ServerDropdown";

const access = vi.hoisted(() => ({ invite: true, event: true }));
vi.mock("@/lib/env", () => ({ apiConfiguration: { url: "/api/v1", configured: true, error: null } }));
vi.mock("@/features/invites/api", async (original) => ({ ...await original<typeof import("@/features/invites/api")>(), useInvitePermissions: () => ({ isSuccess: true, data: { create: access.invite, manage: false } }) }));
vi.mock("@/features/events/api", async (original) => ({ ...await original<typeof import("@/features/events/api")>(), useEventPermissions: () => ({ isSuccess: true, data: { create: access.event, manage: false } }) }));
afterEach(() => { vi.unstubAllGlobals(); access.invite = true; access.event = true; });
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
function setup({ privileged = true, copy = vi.fn(async () => {}) } = {}) {
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: copy } });
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => Response.json(options?.method === "POST" ? channelFixture : { items: [] }));
  vi.stubGlobal("fetch", fetcher);
  render(<AuthContext.Provider value={{ ...signedOutState, session: sessionFixture }}><AppDataProvider><MemoryRouter initialEntries={["/app"]}>
    <ServerDropdown community={communityFixture} canCreateChannel={privileged} /><Location /><button>Outside action</button>
  </MemoryRouter></AppDataProvider></AuthContext.Provider>);
  const trigger = screen.getByRole("button", { name: `Server menu, ${communityFixture.name}` });
  return { trigger, copy, fetcher, open: () => fireEvent.click(trigger) };
}
describe("server dropdown", () => {
  it("contains exactly the requested order, a separator, and no community switcher", () => {
    const { open } = setup(); open();
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Invite People", "Server Settings", "Create Channel", "Create Event", "Copy Server ID"]);
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(screen.queryByText("Your communities")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Leave Server" })).not.toBeInTheDocument();
  });
  it("supports arrows, Home/End, typeahead, Escape and focus restoration", () => {
    const { trigger } = setup(); fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Invite People" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(screen.getByRole("menuitem", { name: "Copy Server ID" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(screen.getByRole("menuitem", { name: "Invite People" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "s" });
    expect(screen.getByRole("menuitem", { name: "Server Settings" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(screen.getByRole("menuitem", { name: "Copy Server ID" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
  });
  it("closes on outside pointerdown and Tab", () => {
    const { open, trigger } = setup(); open();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside action" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false"); open();
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
  it("opens the existing invitation dialog and restores focus to the header", async () => {
    const { open, trigger, fetcher } = setup(); open();
    fireEvent.click(screen.getByRole("menuitem", { name: "Invite People" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: `Invite people to ${communityFixture.name}` })).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close invitation dialog" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("routes settings to the selected server", () => {
    const { open } = setup(); open(); fireEvent.click(screen.getByRole("menuitem", { name: "Server Settings" }));
    expect(screen.getByTestId("location")).toHaveTextContent(`community=${communityFixture.id}&view=overview`);
  });
  it("reuses the channel dialog and sends the current community ID", async () => {
    const { open, fetcher } = setup(); open(); fireEvent.click(screen.getByRole("menuitem", { name: "Create Channel" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "squad" } });
    fireEvent.click(screen.getByRole("button", { name: "Create channel" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(`/api/v1/communities/${communityFixture.id}/channels`, expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "squad" }) })));
  });
  it("opens event creation without voice or upload placeholders", () => {
    const { open } = setup(); open(); fireEvent.click(screen.getByRole("menuitem", { name: "Create Event" }));
    expect(screen.getByRole("dialog", { name: "Create event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event name (required)")).toBeInTheDocument();
    expect(screen.queryByText(/voice channel/i)).not.toBeInTheDocument();
  });
  it("copies the actual ID without a backend request and shows confirmation", async () => {
    const { open, copy, fetcher, trigger } = setup(); open(); fireEvent.click(screen.getByRole("menuitem", { name: "Copy Server ID" }));
    await screen.findByText("Server ID copied");
    expect(copy).toHaveBeenCalledWith(communityFixture.id); expect(fetcher).not.toHaveBeenCalled(); expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.body).not.toHaveTextContent(communityFixture.id);
  });
  it("handles clipboard rejection gracefully", async () => {
    const { open } = setup({ copy: vi.fn(async () => { throw new Error("denied"); }) }); open();
    await act(async () => fireEvent.click(screen.getByRole("menuitem", { name: "Copy Server ID" })));
    expect(screen.getByText("Couldn't copy server ID. Check clipboard permissions and try again.")).toHaveAttribute("role", "status");
  });
  it("hides operations not permitted by the backend", () => {
    access.invite = false; access.event = false;
    const { open } = setup({ privileged: false }); open();
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Server Settings", "Copy Server ID"]);
  });
});
