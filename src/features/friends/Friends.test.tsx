import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataContext } from "@/app/app-data-context";
import { createApiClient } from "@/lib/api/client";
import { profileFixture } from "@/test/api-fixtures";
import { FriendsPage } from "@/features/friends/FriendsPage";
import { CopyUsername } from "@/features/friends/CopyUsername";
import { UsernameSettings } from "@/features/friends/UsernameSettings";
import { RelationshipActions } from "@/features/friends/RelationshipActions";
import { fullUsername, validUsername, validUserTag } from "@/lib/display-name";
import { parsePublicProfile } from "@/lib/api/contracts";

const friend = { ...profileFixture, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", username: "Ash", display_name: "Ashley", discriminator: "0007" };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function setup(renderSettings = false) {
  let pending = false;
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (init?.method === "POST") {
      pending = true;
      return Response.json({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", status: "pending" });
    }
    if (init?.method === "PATCH") return Response.json({ ...profileFixture, username: "Dragon", discriminator: "0024" });
    if (path === "/bootstrap") return Response.json({ profile: profileFixture, communities: { items: [] } });
    if (path === "/friends/summary") return Response.json({ friends: 0, incoming: 0, outgoing: pending ? 1 : 0, blocked: 0 });
    return Response.json({ items: path === "/friends/requests" && pending ? [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", incoming: false, created_at: "2026-11-17T10:00:00Z", profile: friend }] : [], next_cursor: null });
  });
  vi.stubGlobal("fetch", fetcher);
  const api = createApiClient({ baseUrl: "https://core.test", sessionSignal: () => new AbortController().signal, onUnauthorized: async () => "active" });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={queries}><AppDataContext.Provider value={{ api, ready: true, configured: true, configurationError: null, clearPrivateData: vi.fn() }}><MemoryRouter initialEntries={["/friends"]}><Routes><Route path="/friends" element={renderSettings ? <UsernameSettings profile={{ ...profileFixture, discriminator: "0024" }} /> : <FriendsPage />} /></Routes></MemoryRouter></AppDataContext.Provider></QueryClientProvider>);
  return { fetcher, queries };
}
describe("public identity and friends", () => {
  it("preserves zeros, rejects malformed handles, and strips private response fields", () => {
    expect(fullUsername(friend)).toBe("Ash#0007");
    expect(validUserTag(" Ash#0007 ")).toBe(true);
    for (const tag of ["Ash", "Ash#7", "Ash##0007", "Ash #0007", "Aśh#0007", "admin#0007"]) expect(validUserTag(tag)).toBe(false);
    expect(validUsername(" SYSTEM ")).toBe(false);
    expect(parsePublicProfile(friend)).not.toHaveProperty("email");
    expect(() => parsePublicProfile({ ...friend, discriminator: "7" })).toThrow();
  });
  it("shows honest empty/presence states, validates full tags, sends and refreshes outgoing requests", async () => {
    const { fetcher } = setup();
    expect(await screen.findByText("Your people are out there")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Online" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Add Friend" }));
    fireEvent.change(screen.getByLabelText("Full username"), { target: { value: "Ash" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Friend Request" }));
    expect(screen.getByRole("alert")).toHaveTextContent("complete Core username");
    expect(fetcher.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Full username"), { target: { value: "Ash#0007" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Friend Request" }));
    expect(await screen.findByText("Friend request sent.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pending/ }));
    expect(await screen.findByRole("button", { name: "Cancel Request" })).toBeInTheDocument();
    expect(screen.getByText(/Outgoing · Pending/)).toBeInTheDocument();
    expect(fetcher.mock.calls.find((call) => call[1]?.method === "POST")?.[1]?.body).toBe('{"username":"Ash#0007"}');
  });
  it("copies the complete username and reports clipboard failures", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<CopyUsername profile={friend} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Username" }));
    expect(await screen.findByText("Username copied.")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("Ash#0007");
    writeText.mockRejectedValueOnce(new Error());
    fireEvent.click(screen.getByRole("button", { name: "Copy Username" }));
    expect(await screen.findByText(/Couldn't copy/)).toBeInTheDocument();
  });
  it("renames only the username through Rust and refreshes the cached profile", async () => {
    const { fetcher, queries } = setup(true);
    fireEvent.change(screen.getByLabelText("Change username"), { target: { value: " Dragon " } });
    fireEvent.click(screen.getByRole("button", { name: "Save username" }));
    expect(await screen.findByText("Username updated.")).toBeInTheDocument();
    expect(fetcher.mock.calls.find((call) => call[1]?.method === "PATCH")?.[1]?.body).toBe('{"username":"Dragon"}');
    await waitFor(() => expect(queries.getQueryData(["profile"])).toMatchObject({ id: profileFixture.id, username: "Dragon", discriminator: "0024" }));
  });
  it("keeps the entered username and confirmed state when a send fails", async () => {
    const { fetcher } = setup();
    await screen.findByText("Your people are out there");
    fireEvent.click(screen.getByRole("button", { name: "Add Friend" }));
    fireEvent.change(screen.getByLabelText("Full username"), { target: { value: "Ash#0007" } });
    fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));
    fireEvent.click(screen.getByRole("button", { name: "Send Friend Request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.getByLabelText("Full username")).toHaveValue("Ash#0007");
    expect(screen.queryByText("Friend request sent.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Friend Request" })).toBeEnabled();
  });
  it.each([
    ["none", "Add Friend", "POST", "/friends/requests"],
    ["incoming", "Accept", "POST", "/friends/requests/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/accept"],
    ["incoming", "Decline", "POST", "/friends/requests/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/decline"],
    ["outgoing", "Cancel Request", "DELETE", "/friends/requests/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    ["friends", "Remove Friend", "DELETE", `/friends/${friend.id}`],
    ["friends", "Block User", "POST", `/users/${friend.id}/block`],
    ["blocked", "Unblock", "DELETE", `/users/${friend.id}/block`],
  ])("performs %s → %s through the authenticated Rust API", async (state, label, method, path) => {
    const request = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method !== "GET") return method === "POST" && path === "/friends/requests"
        ? Response.json({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", status: "pending" })
        : new Response(null, { status: 204 });
      return Response.json({ state, request_id: ["incoming", "outgoing"].includes(state!) ? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" : null });
    });
    vi.stubGlobal("fetch", request);
    const api = createApiClient({ baseUrl: "https://core.test", sessionSignal: () => new AbortController().signal, onUnauthorized: async () => "active" });
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queries}><AppDataContext.Provider value={{ api, ready: true, configured: true, configurationError: null, clearPrivateData: vi.fn() }}><RelationshipActions profile={friend} /></AppDataContext.Provider></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", { name: label }));
    await waitFor(() => expect(request).toHaveBeenCalledWith(`https://core.test${path}`, expect.objectContaining({ method, credentials: "include", headers: expect.objectContaining({ "X-Core-CSRF": "1" }) })));
  });
});
