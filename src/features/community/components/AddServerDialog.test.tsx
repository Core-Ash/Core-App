import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataProvider } from "@/app/AppDataProvider";
import { AuthContext } from "@/features/auth/auth-context";
import { AddServerDialog } from "@/features/community/components/AddServerDialog";
import { CreateCommunityDialog } from "@/features/community/components/CreateResourceDialog";
import { InvitePage } from "@/features/invites/InvitePage";
import { inviteDestination } from "@/features/invites/invite-link";
import { communityFixture } from "@/test/api-fixtures";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";

vi.mock("@/lib/env", () => ({ apiConfiguration: { url: "/api/v1", configured: true, error: null } }));
afterEach(() => vi.unstubAllGlobals());
const code = "a".repeat(64);
function Location() { const location = useLocation(); return <div data-testid="location">{location.pathname}{location.search}</div>; }
function setup() {
  const request = vi.fn(async (url: string) => {
    if (url.endsWith("/status")) return Response.json({ already_member: false, community_id: null });
    if (url.endsWith("/accept")) return Response.json({ already_member: false, community_id: communityFixture.id });
    if (url.endsWith("/me")) return Response.json({});
    return Response.json({ server: { name: "Dragons Den", description: null, icon_url: null, banner_url: null, member_count: 42 }, expires_at: null });
  });
  vi.stubGlobal("fetch", request);
  render(<AuthContext.Provider value={{ ...signedOutState, session: sessionFixture }}><AppDataProvider><MemoryRouter initialEntries={["/app"]}>
    <Routes>
      <Route path="/app" element={<AddServerDialog><button>Add server</button></AddServerDialog>} />
      <Route path="/invite/:code" element={<InvitePage />} />
    </Routes><Location />
  </MemoryRouter></AppDataProvider></AuthContext.Provider>);
  return request;
}
describe("add server", () => {
  it("offers create or join and reuses the existing creation dialog", async () => {
    const request = setup();
    const trigger = screen.getByRole("button", { name: "Add server" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Add a server" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join a server" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create a server" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Create a server" })).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Add a server" })).toBeInTheDocument();
  });
  it("opens a pasted link locally and joins only after explicit acceptance", async () => {
    const request = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add server" }));
    fireEvent.click(screen.getByRole("button", { name: "Join a server" }));
    const input = screen.getByRole("textbox", { name: "Invite link or code" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: `https://core.example.com/invite/${code}` } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to invite" }));
    await screen.findByRole("heading", { name: "Dragons Den" });
    expect(screen.getByTestId("location")).toHaveTextContent(`/invite/${code}`);
    expect(request.mock.calls.map(([url]) => url).every((url) => !url.endsWith("/accept") && !url.endsWith("/me"))).toBe(true);
    fireEvent.click(await screen.findByRole("button", { name: "Join Server" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(`community=${communityFixture.id}`));
    expect(request.mock.calls.some(([url]) => url.endsWith("/accept"))).toBe(true);
  });
  it("shows invalid input without navigation or backend requests", () => {
    const request = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add server" }));
    fireEvent.click(screen.getByRole("button", { name: "Join a server" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "https://example.com/not-an-invite" } });
    fireEvent.submit(screen.getByRole("form", { name: "Join a server" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid Core invite link");
    expect(screen.getByTestId("location")).toHaveTextContent("/app");
    expect(request).not.toHaveBeenCalled();
  });
  it("supports going back and resets the join form when reopened", () => {
    setup();
    const trigger = screen.getByRole("button", { name: "Add server" });
    fireEvent.click(trigger); fireEvent.click(screen.getByRole("button", { name: "Join a server" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Join a server" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Join a server" }));
    expect(screen.getByRole("textbox")).toHaveValue(code);
    fireEvent.click(screen.getByRole("button", { name: "Close add server dialog" }));
    fireEvent.click(trigger); fireEvent.click(screen.getByRole("button", { name: "Join a server" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });
  it("allows switching between creating a server and joining with an invite link", async () => {
    setup();
    const trigger = screen.getByRole("button", { name: "Add server" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Create a server" }));
    expect(screen.getByRole("dialog", { name: "Create a server" })).toBeInTheDocument();

    // From Create a server -> Join with an invite link
    fireEvent.click(screen.getByRole("button", { name: "Join an existing server with an invite link" }));
    expect(screen.getByRole("dialog", { name: "Join a server" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Invite link or code" })).toBeInTheDocument();

    // From Join a server -> Create a server instead
    fireEvent.click(screen.getByRole("button", { name: "Create a server instead" }));
    expect(screen.getByRole("dialog", { name: "Create a server" })).toBeInTheDocument();

    // From Create a server -> Back to choices
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "Add a server" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Create a server" })).toHaveFocus());
  });
  it("offers join link option in standalone CreateCommunityDialog", () => {
    render(
      <AuthContext.Provider value={{ ...signedOutState, session: sessionFixture }}>
        <AppDataProvider>
          <MemoryRouter initialEntries={["/app"]}>
            <CreateCommunityDialog open>
              <button>Open</button>
            </CreateCommunityDialog>
          </MemoryRouter>
        </AppDataProvider>
      </AuthContext.Provider>
    );
    expect(screen.getByRole("dialog", { name: "Create a server" })).toBeInTheDocument();
    const joinButton = screen.getByRole("button", { name: "Join an existing server with an invite link" });
    expect(joinButton).toBeInTheDocument();
    fireEvent.click(joinButton);
    expect(screen.getByRole("dialog", { name: "Join a server" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Invite link or code" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to create" }));
    expect(screen.getByRole("dialog", { name: "Create a server" })).toBeInTheDocument();
  });
});
describe("invite link extraction", () => {
  it.each([code, `/invite/${code}`, `/invite/${code}/`, ` https://core.example.com/invite/${code} `, `http://localhost:5173/invite/${code}`, `http://127.0.0.1:5173/invite/${code}`])("extracts the local destination from %s", (value) => {
    expect(inviteDestination(value)).toBe(`/invite/${code}`);
  });
  it.each(["", "not-a-code", `javascript:/invite/${code}`, `https://user:pass@core.example.com/invite/${code}`, `http://example.com/invite/${code}`, `//example.com/invite/${code}`, `https://core.example.com/invite/${code}?next=https://evil.test`, `https://core.example.com/invite/${code}#fragment`, `https://core.example.com\\invite\\${code}`, `https://core.example.com/invite/\n${code}`, `https://core.example.com/invite/${"a".repeat(63)}`])("rejects malformed or unsafe input %s", (value) => {
    expect(inviteDestination(value)).toBeNull();
  });
});
