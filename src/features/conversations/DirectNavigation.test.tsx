import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataContext } from "@/app/app-data-context";
import { createApiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { profileFixture } from "@/test/api-fixtures";
import { FriendsPage } from "@/features/friends/FriendsPage";
import { ConversationSearchDialog } from "@/features/conversations/components/ConversationSearchDialog";
import { DmUserMenu } from "@/features/conversations/components/DmUserMenu";
import { MessagesPage } from "@/features/messages/MessagesPage";
import { CreateGroupDmDialog } from "@/features/conversations/components/CreateGroupDmDialog";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import { messageFixture } from "@/test/api-fixtures";
import { useOpenConversation } from "@/features/conversations/use-open-conversation";
import { parseConversationDetail } from "@/lib/api/contracts";

const friend = { ...profileFixture, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", username: "Dragon", display_name: "Dragon Slayer", discriminator: "0024" };
const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const raw = {
  id, type: "direct", name: null, icon_url: null, created_by: profileFixture.id,
  created_at: "2026-11-18T10:00:00Z", updated_at: "2026-11-18T10:00:00Z", last_message_at: "2026-11-18T10:00:00Z",
  members: [profileFixture, friend].map((profile) => ({ id: profile.id, profile, role: "member", joined_at: "2026-11-18T10:00:00Z" })),
};
const summary = { ...raw, role: "member", hidden: false, last_message: null };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function setup(element: React.ReactNode, { existing = false, status = 201, payload = raw, restore = false, friends = [friend] } = {}) {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    const path = new URL(url).pathname;
    if (path === "/conversations/direct") return status >= 400 ? new Response(null, { status }) : Response.json(payload, { status });
    if (path === "/conversations/group") return status >= 400 ? new Response(null, { status }) : Response.json({ ...raw, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", type: "group", role: "owner" }, { status: 201 });
    if (path === "/bootstrap") return Response.json({ profile: profileFixture, communities: { items: [] } });
    if (path === "/friends/summary") return Response.json({ friends: 1, incoming: 0, outgoing: 0, blocked: 0 });
    if (path === "/friends") return Response.json({ items: friends, next_cursor: null });
    if (path === `/conversations/${id}/messages`) return Response.json({ items: [{ ...messageFixture, body: "Restored DM history" }], next_cursor: null });
    if (path === "/conversations") return Response.json({ items: existing ? [summary] : [] });
    if (path.endsWith("/relationship")) return Response.json({ state: "friends", request_id: null });
    if (options?.method === "GET") return Response.json({ ...raw, role: "member" });
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal("fetch", fetcher);
  const api = createApiClient({ baseUrl: "https://core.test", sessionSignal: () => new AbortController().signal, onUnauthorized: async () => "active" });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queries.setQueryData(["profile"], profileFixture);
  if (existing) queries.setQueryData(["conversations"], [summary]);
  render(<QueryClientProvider client={queries}><AppDataContext.Provider value={{ api, ready: true, configured: true, configurationError: null, clearPrivateData: vi.fn() }}><MemoryRouter initialEntries={[restore ? `/app/messages/${id}` : "/app/friends"]}><Routes><Route path="/app/friends" element={element} /><Route path="/app/messages/:conversationId" element={restore ? <MessagesPage /> : <p>Conversation opened</p>} /></Routes></MemoryRouter></AppDataContext.Provider></QueryClientProvider>);
  return { fetcher, api, queries };
}
function Openers() {
  const first = useOpenConversation();
  const second = useOpenConversation();
  return <><button onClick={() => { void first.openDirect(friend.id).catch(() => {}); }}>First</button><button onClick={() => { void second.openDirect(friend.id).catch(() => {}); }}>Second</button></>;
}
describe("direct conversation navigation", () => {
  it.each([200, 201])("accepts Rust's %s direct-open response without role", async (status) => {
    const { api, fetcher } = setup(<p>Ready</p>, { status });
    const conversation = await endpoints.createDirectConversation(api, { recipient_id: friend.id });
    expect(conversation).toMatchObject({ id, role: "member" });
    expect(fetcher).toHaveBeenCalledWith("https://core.test/conversations/direct", expect.objectContaining({ method: "POST", credentials: "include", body: JSON.stringify({ recipient_id: friend.id }) }));
    expect(() => parseConversationDetail(raw)).toThrow();
    expect(() => parseConversationDetail({ ...raw, type: "group" }, true)).toThrow();
  });
  it("shares an in-flight request across independent entry points", async () => {
    const { fetcher } = setup(<Openers />);
    fireEvent.click(screen.getByText("First")); fireEvent.click(screen.getByText("Second"));
    expect(await screen.findByText("Conversation opened")).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/conversations/direct"))).toHaveLength(1);
  });
  it.each([false, true])("opens a friend's conversation through their profile with existing=%s and isolates its menu", async (existing) => {
    const { fetcher } = setup(<FriendsPage />, { existing });
    const profile = await screen.findByRole("button", { name: "View profile for Dragon Slayer" });
    expect(screen.queryByRole("button", { name: "Message Dragon Slayer" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText("More options for Dragon#0024"), { key: "ArrowDown" });
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/conversations/direct"))).toHaveLength(0);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    fireEvent.click(profile);
    const button = screen.getByRole("button", { name: "Open conversation with Dragon Slayer" });
    fireEvent.click(button); fireEvent.click(button);
    expect(await screen.findByText("Conversation opened")).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/conversations/direct"))).toHaveLength(existing ? 0 : 1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it.each([400, 401, 403, 404, 409, 500])("shows inline errors for HTTP %s without navigating", async (status) => {
    setup(<FriendsPage />, { status });
    fireEvent.click(await screen.findByRole("button", { name: "View profile for Dragon Slayer" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation with Dragon Slayer" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Conversation opened")).not.toBeInTheDocument();
  });
  it("rejects incomplete success payloads instead of navigating to undefined", async () => {
    const { api } = setup(<p>Ready</p>);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(endpoints.createDirectConversation(api, { recipient_id: friend.id })).rejects.toMatchObject({ kind: "invalid_response" });
  });
  it.each([false, true])("searches full handles, uses keyboard navigation, and reuses existing=%s", async (existing) => {
    const { fetcher } = setup(<ConversationSearchDialog onClose={vi.fn()} />, { existing });
    await screen.findByText("Dragon Slayer");
    const input = screen.getByRole("combobox", { name: "Search conversations and friends" });
    fireEvent.change(input, { target: { value: "nobody" } });
    expect(screen.getByText("No matching conversations or friends.")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "dragon#0024" } });
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/conversations/direct"))).toHaveLength(0);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const result = screen.getByRole("option", { name: /Dragon Slayer/ });
    expect(input).toHaveFocus();
    expect(result).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("Conversation opened")).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/conversations/direct"))).toHaveLength(existing ? 0 : 1);
  });
  it("restores the conversation and message history directly from its URL", async () => {
    const { fetcher } = setup(<p>Ready</p>, { restore: true });
    expect(await screen.findByText("Restored DM history")).toBeInTheDocument();
    expect(screen.getByText("Dragon Slayer")).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/conversations/direct"))).toHaveLength(0);
    expect(fetcher).toHaveBeenCalledWith(`https://core.test/conversations/${id}/messages?limit=50`, expect.objectContaining({ method: "GET", credentials: "include" }));
  });
  it("creates a separate group even when one friend is selected", async () => {
    setup(<CreateGroupDmDialog open onOpenChange={vi.fn()} />, { existing: true });
    fireEvent.click(await screen.findByText("Dragon Slayer"));
    fireEvent.click(screen.getByRole("button", { name: "Create Group DM" }));
    expect(await screen.findByText("Conversation opened")).toBeInTheDocument();
  });
  it("keeps failed group submissions open with selection and query intact", async () => {
    const close = vi.fn();
    setup(<CreateGroupDmDialog open onOpenChange={close} />, { status: 500 });
    fireEvent.click(await screen.findByText("Dragon Slayer"));
    fireEvent.change(screen.getByRole("textbox", { name: "Search friends" }), { target: { value: "dragon#0024" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Group DM" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Search friends" })).toHaveValue("dragon#0024");
    expect(screen.getByText("Selected: 1/8")).toBeInTheDocument();
  });
  it("excludes self and deduplicates friends and initial selection", async () => {
    const { fetcher, queries } = setup(<CreateGroupDmDialog open onOpenChange={vi.fn()} initialSelectedIds={[profileFixture.id, friend.id, friend.id]} />, {
      friends: [friend, friend, { ...profileFixture, discriminator: "0007" }],
    });
    expect(await screen.findByText("Selected: 1/8")).toBeInTheDocument();
    expect(screen.queryByText(profileFixture.display_name)).not.toBeInTheDocument();
    expect(screen.getAllByText("Dragon Slayer")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Create Group DM" }));
    expect(await screen.findByText("Conversation opened")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith("https://core.test/conversations/group", expect.objectContaining({ method: "POST", body: JSON.stringify({ recipient_ids: [friend.id] }) }));
    expect(queries.getQueryData(["conversations"])).toEqual(expect.arrayContaining([expect.objectContaining({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", type: "group" })]));
  });
  it("enforces eight selectable users and supports deselection", async () => {
    const friends = Array.from({ length: 9 }, (_, index) => ({ ...friend, id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`, display_name: `Friend ${index}` }));
    setup(<CreateGroupDmDialog open onOpenChange={vi.fn()} />, { friends });
    await screen.findByText("Friend 0");
    for (const item of friends) fireEvent.click(screen.getByText(item.display_name));
    expect(screen.getByText("Selected: 8/8")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("only add up to 8");
    fireEvent.click(screen.getByText("Friend 0"));
    expect(screen.getByText("Selected: 7/8")).toBeInTheDocument();
  });
  it("keeps profile management actions and opens conversations through the name", async () => {
    setup(<MemberIdentity profile={friend} />);
    fireEvent.click(screen.getByRole("button", { name: "View profile for Dragon Slayer" }));
    expect(await screen.findByRole("button", { name: "Remove Friend" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Block User" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Username" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open conversation with Dragon Slayer" }));
    expect(await screen.findByText("Conversation opened")).toBeInTheDocument();
  });
  it("closes search with Escape", async () => {
    const close = vi.fn(); setup(<ConversationSearchDialog onClose={close} />);
    await screen.findByText("Dragon Slayer");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(close).toHaveBeenCalled());
  });
});

function menuEntry(close = vi.fn().mockResolvedValue(undefined)) {
  return <DmUserMenu profile={friend} conversationId={id} onCloseConversation={close}><a href={`/app/messages/${id}`}>Dragon DM</a></DmUserMenu>;
}
describe("DM user context menu", () => {
  it("opens on right click without navigating, supports arrows and Escape, and dismisses outside", async () => {
    const { fetcher } = setup(menuEntry());
    const link = screen.getByRole("link", { name: "Dragon DM" });
    fireEvent.contextMenu(link, { clientX: 100, clientY: 200 });
    const menu = screen.getByRole("menu", { name: "User menu for Dragon Slayer" });
    expect(menu).toHaveStyle({ left: "100px", top: "200px" });
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Close DM" })).toHaveFocus();
    await screen.findByRole("menuitem", { name: "Remove Friend" });
    expect(screen.getByRole("menuitem", { name: "Block User" })).toBeInTheDocument();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument(); expect(link).toHaveFocus();
    fireEvent.contextMenu(link); fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  });
  it("opens from the keyboard and shows the existing profile popup", async () => {
    setup(menuEntry()); const link = screen.getByRole("link"); link.focus();
    fireEvent.keyDown(link, { key: "F10", shiftKey: true });
    fireEvent.click(screen.getByRole("menuitem", { name: "Profile" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Copy Username" })).toBeInTheDocument();
  });
  it("copies the requested IDs and full username", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    setup(menuEntry());
    for (const [label, value] of [["Copy Username", "Dragon#0024"], ["Copy User ID", friend.id], ["Copy Conversation ID", id]]) {
      fireEvent.contextMenu(screen.getByRole("link"));
      fireEvent.click(screen.getByRole("menuitem", { name: label }));
      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
      expect(writeText).toHaveBeenLastCalledWith(value);
    }
  });
  it("keeps a failed close visible and closes the menu after a successful retry", async () => {
    const close = vi.fn().mockRejectedValueOnce(new Error()).mockResolvedValue(undefined);
    setup(menuEntry(close)); fireEvent.contextMenu(screen.getByRole("link"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close DM" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't close this conversation");
    fireEvent.click(screen.getByRole("menuitem", { name: "Close DM" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(close).toHaveBeenCalledTimes(2);
  });
  it("performs block through the existing authenticated API and dismisses after success", async () => {
    const { fetcher } = setup(menuEntry()); fireEvent.contextMenu(screen.getByRole("link"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Block User" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(fetcher).toHaveBeenCalledWith(`https://core.test/users/${friend.id}/block`, expect.objectContaining({ method: "POST", credentials: "include" }));
  });
  it("renders a Core Bot notice and removes pending send when DM send returns DIRECT_MESSAGE_NOT_DELIVERED", async () => {
    const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
      const path = new URL(url).pathname;
      if (path === `/conversations/${id}/messages` && options?.method === "POST") {
        return new Response(
          JSON.stringify({
            code: "DIRECT_MESSAGE_NOT_DELIVERED",
            error: "Your message could not be delivered.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
      if (path === `/conversations/${id}/messages`) return Response.json({ items: [], next_cursor: null });
      if (path === `/conversations/${id}`) return Response.json({ ...raw, role: "member" });
      if (path === "/conversations") return Response.json({ items: [summary] });
      if (path === "/bootstrap") return Response.json({ profile: profileFixture, communities: { items: [] } });
      if (path === "/profile") return Response.json(profileFixture);
      if (path === "/friends/summary") return Response.json({ friends: 0, incoming: 0, outgoing: 0, blocked: 1 });
      if (path === "/friends") return Response.json({ items: [], next_cursor: null });
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetcher);
    const api = createApiClient({
      baseUrl: "https://core.test",
      sessionSignal: () => new AbortController().signal,
      onUnauthorized: async () => "active",
    });
    const queries = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queries.setQueryData(["profile"], profileFixture);
    queries.setQueryData(["conversations"], [summary]);

    render(
      <QueryClientProvider client={queries}>
        <AppDataContext.Provider
          value={{
            api,
            ready: true,
            configured: true,
            configurationError: null,
            clearPrivateData: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={[`/app/messages/${id}`]}>
            <Routes>
              <Route path="/app/messages/:conversationId" element={<MessagesPage />} />
            </Routes>
          </MemoryRouter>
        </AppDataContext.Provider>
      </QueryClientProvider>,
    );

    const input = await screen.findByRole("textbox", { name: "Message #Dragon Slayer" });
    fireEvent.change(input, { target: { value: "Hello friend" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Core Bot")).toBeInTheDocument();
    expect(screen.getByText("Your message could not be delivered.")).toBeInTheDocument();
    expect(screen.getByText("Dismiss message")).toBeInTheDocument();

    // Verify pending message was discarded, not showing retry
    expect(screen.queryByText("Retry")).not.toBeInTheDocument();

    // Dismiss notice
    fireEvent.click(screen.getByText("Dismiss message"));
    await waitFor(() => {
      expect(screen.queryByText("Your message could not be delivered.")).not.toBeInTheDocument();
    });
  });
});
