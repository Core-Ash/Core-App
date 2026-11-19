import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataContext } from "@/app/app-data-context";
import { createApiClient } from "@/lib/api/client";
import { FriendsPage } from "@/features/friends/FriendsPage";
import { profileFixture } from "@/test/api-fixtures";

const friend = { ...profileFixture, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", username: "Ash", display_name: "Ashley", discriminator: "0007" };
const other = { ...friend, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", username: "Dragon", display_name: "Dragon Slayer", discriminator: "0024" };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function setup({ fail = false, self = false } = {}) {
  let removed = false;
  let blocked = false;
  let failure = fail;
  vi.stubGlobal("PointerEvent", MouseEvent);
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (init?.method === "DELETE" || init?.method === "POST") {
      if (failure) { failure = false; return new Response(null, { status: 503 }); }
      removed = true;
      blocked = init.method === "POST";
      return new Response(null, { status: 204 });
    }
    if (path === "/bootstrap") return Response.json({ profile: profileFixture, communities: { items: [] } });
    if (path === "/friends/summary") return Response.json({ friends: removed ? 1 : 2, incoming: 0, outgoing: 0, blocked: blocked ? 1 : 0 });
    if (path.endsWith("/relationship")) return Response.json({ state: self ? "self" : "friends", request_id: null });
    if (path === "/users/blocked") return Response.json({ items: blocked ? [friend] : [], next_cursor: null });
    return Response.json({ items: removed ? [other] : [friend, other], next_cursor: null });
  });
  vi.stubGlobal("fetch", fetcher);
  const api = createApiClient({ baseUrl: "https://core.test", sessionSignal: () => new AbortController().signal, onUnauthorized: async () => "active" });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queries.setQueryData(["profile"], profileFixture);
  render(<StrictMode><QueryClientProvider client={queries}><AppDataContext.Provider value={{ api, ready: true, configured: true, configurationError: null, clearPrivateData: vi.fn() }}><MemoryRouter initialEntries={["/app/friends"]}><FriendsPage /></MemoryRouter></AppDataContext.Provider></QueryClientProvider></StrictMode>);
  return { fetcher, queries };
}
async function open(tag = "Ash#0007") {
  const trigger = await screen.findByRole("button", { name: `More options for ${tag}` });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  return trigger;
}

describe("Friends user actions menu", () => {
  it("portals three icon rows and supports keyboard focus, Escape, and trigger toggle", async () => {
    setup();
    const trigger = await screen.findByRole("button", { name: "More options for Ash#0007" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const menu = await screen.findByRole("menu", { name: "User actions for Ashley" });
    await screen.findByRole("menuitem", { name: "Remove Friend" });
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["View Profile", "Remove Friend", "Block User"]);
    expect(menu.closest(".friends-list")).toBeNull();
    for (const item of within(menu).getAllByRole("menuitem")) expect(item.querySelector("svg")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Remove Friend" })).toHaveAttribute("data-tone", "remove");
    expect(within(menu).getByRole("menuitem", { name: "Block User" })).toHaveAttribute("data-tone", "danger");
    await waitFor(() => expect(within(menu).getByRole("menuitem", { name: "View Profile" })).toHaveFocus());
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Remove Friend" })).toHaveFocus());
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await open();
    await open();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
  it("keeps one menu open, dismisses outside, and never creates a conversation", async () => {
    const { fetcher } = setup();
    await open();
    await open("Dragon#0024");
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.getByRole("menu", { name: "User actions for Dragon Slayer" })).toBeInTheDocument();
    await screen.findByRole("menuitem", { name: "Remove Friend" });
    fireEvent.pointerDown(document.body, { button: 0, pointerType: "mouse" });
    fireEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(fetcher.mock.calls.some(([url]) => url.includes("/conversations"))).toBe(false);
  });
  it("hands focus to the selected profile and returns it to the three-dot trigger", async () => {
    const { fetcher } = setup();
    const trigger = await open();
    fireEvent.click(screen.getByRole("menuitem", { name: "View Profile" }));
    const card = await screen.findByRole("dialog", { name: "Ashley" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(within(card).getByText("Ash#0007")).toBeInTheDocument();
    await waitFor(() => expect(card.contains(document.activeElement)).toBe(true));
    expect(fetcher.mock.calls.some(([url]) => url.includes("/conversations"))).toBe(false);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it.each([
    ["Remove Friend", "DELETE", `/friends/${friend.id}`],
    ["Block User", "POST", `/users/${friend.id}/block`],
  ])("performs %s through Rust and refreshes the list", async (label, method, path) => {
    const { fetcher } = setup();
    await open();
    fireEvent.click(await screen.findByRole("menuitem", { name: label }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "More options for Ash#0007" })).not.toBeInTheDocument());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(`https://core.test${path}`, expect.objectContaining({ method, credentials: "include" }));
    if (method === "POST") {
      fireEvent.click(screen.getByRole("button", { name: "Blocked" }));
      expect(await screen.findByRole("button", { name: "Unblock" })).toBeInTheDocument();
    }
  });
  it("keeps a failed action and error visible and allows retry", async () => {
    setup({ fail: true });
    await open();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove Friend" }));
    const menu = screen.getByRole("menu");
    expect(await within(menu).findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove Friend" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
  it("omits relationship actions for a self relationship", async () => {
    setup({ self: true });
    await open();
    await waitFor(() => expect(screen.queryByText("Loading relationship...")).not.toBeInTheDocument());
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    expect(screen.getByRole("menuitem", { name: "View Profile" })).toBeInTheDocument();
  });
});
