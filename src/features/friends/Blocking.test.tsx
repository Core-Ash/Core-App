import { StrictMode, type ReactNode } from "react";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataContext } from "@/app/app-data-context";
import { createApiClient } from "@/lib/api/client";
import { profileFixture } from "@/test/api-fixtures";
import { RelationshipActions } from "@/features/friends/RelationshipActions";
import { useFriendAction, useFriendCounts, useFriendList, type FriendPage, type FriendRequest, type Relationship } from "@/features/friends/api";
import type { PublicProfile } from "@/lib/api/types";

const friend: PublicProfile = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", username: "Dragon", discriminator: "0024", display_name: "Dragon", avatar_url: null };
const requestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const key = (kind: string) => ["relationships", kind];
const relationshipKey = ["relationships", "user", friend.id];
const historyKey = ["conversation-messages", "existing-dm"];
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function CacheReaders() {
  useFriendList("friends"); useFriendList("requests"); useFriendList("blocked"); useFriendCounts();
  return null;
}
async function setup({ initial = "friends", fail = false, delayRefresh = false }: { initial?: Relationship["state"]; fail?: boolean; delayRefresh?: boolean } = {}) {
  let relationship = initial;
  let observe = true;
  let blocked = false;
  let afterMutation = false;
  let release!: () => void;
  const refreshGate = new Promise<void>((resolve) => { release = resolve; });
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (init?.method === "POST") {
      if (fail) return new Response(null, { status: 503 });
      blocked = true; relationship = "blocked"; afterMutation = true;
      return new Response(null, { status: 204 });
    }
    if (init?.method === "DELETE") {
      blocked = false; relationship = "none"; afterMutation = true;
      return new Response(null, { status: 204 });
    }
    if (delayRefresh && afterMutation) await refreshGate;
    if (path === "/bootstrap") return Response.json({ profile: profileFixture, communities: { items: [] } });
    if (path.endsWith("/relationship")) return Response.json({ state: relationship, request_id: ["incoming", "outgoing"].includes(relationship) ? requestId : null });
    if (path === "/friends/summary") return Response.json({ friends: relationship === "friends" ? 1 : 0, incoming: relationship === "incoming" ? 1 : 0, outgoing: relationship === "outgoing" ? 1 : 0, blocked: blocked ? 1 : 0 });
    if (path === "/friends") return Response.json({ items: relationship === "friends" ? [friend] : [], next_cursor: null });
    if (path === "/users/blocked") return Response.json({ items: blocked ? [friend] : [], next_cursor: null });
    if (path === "/friends/requests") return Response.json({ items: ["incoming", "outgoing"].includes(relationship) ? [{ id: requestId, incoming: relationship === "incoming", created_at: "2026-11-19T10:00:00Z", profile: friend }] : [], next_cursor: null });
    throw new Error("Unexpected API request");
  });
  vi.stubGlobal("fetch", fetcher);
  const api = createApiClient({ baseUrl: "https://core.test", sessionSignal: () => new AbortController().signal, onUnauthorized: async () => "active" });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  queries.setQueryData(["profile"], profileFixture);
  const history = { pages: [{ items: [{ id: "message", body: "Existing DM history" }], next_cursor: null }], pageParams: [null] };
  queries.setQueryData(historyKey, history);
  function Wrapper({ children }: { children: ReactNode }) {
    return <StrictMode><QueryClientProvider client={queries}><AppDataContext.Provider value={{ api, ready: true, configured: true, configurationError: null, clearPrivateData: vi.fn() }}>
      {observe && <CacheReaders />}<RelationshipActions profile={friend} />{children}
    </AppDataContext.Provider></QueryClientProvider></StrictMode>;
  }
  const hook = renderHook(() => useFriendAction(), { wrapper: Wrapper });
  await waitFor(() => {
    for (const kind of ["friends", "requests", "blocked", "summary"]) expect(queries.getQueryState(key(kind))?.status).toBe("success");
    expect(queries.getQueryState(relationshipKey)?.status).toBe("success");
  });
  // Leave list tabs cached but unmounted, matching real tab navigation.
  observe = false;
  hook.rerender();
  const profiles = (kind: string) => queries.getQueryData<InfiniteData<FriendPage<PublicProfile>>>(key(kind))?.pages.flatMap((page) => page.items);
  const requests = () => queries.getQueryData<InfiniteData<FriendPage<FriendRequest>>>(key("requests"))?.pages.flatMap((page) => page.items);
  return { hook, queries, fetcher, release, history, profiles, requests };
}

describe("blocking relationship caches", () => {
  it("removes a successful block from cached friends immediately, updates an open profile, and preserves DM history", async () => {
    const { hook, queries, fetcher, release, profiles, history } = await setup({ delayRefresh: true });
    let completed!: Promise<unknown>;
    act(() => { completed = hook.result.current.mutateAsync({ action: "block", id: friend.id }); });
    await waitFor(() => expect(profiles("friends")).toEqual([]));
    expect(profiles("blocked")).toEqual([friend]);
    expect(queries.getQueryData(relationshipKey)).toEqual({ state: "blocked", request_id: null });
    expect(await screen.findByRole("button", { name: "Unblock" })).toBeInTheDocument();
    expect(queries.getQueryData(historyKey)).toEqual(history);
    await act(async () => { release(); await completed; });
    expect(queries.getQueryData(key("summary"))).toMatchObject({ friends: 0, blocked: 1 });
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    expect(fetcher).toHaveBeenCalledWith(`https://core.test/users/${friend.id}/block`, expect.objectContaining({ method: "POST", credentials: "include" }));
  });
  it.each(["incoming", "outgoing"] as const)("clears a cached %s request and counts", async (initial) => {
    const { hook, queries, requests, profiles } = await setup({ initial });
    expect(requests()).toHaveLength(1);
    await act(async () => { await hook.result.current.mutateAsync({ action: "block", id: friend.id }); });
    expect(requests()).toEqual([]);
    expect(profiles("blocked")).toEqual([friend]);
    expect(queries.getQueryData(key("summary"))).toEqual({ friends: 0, incoming: 0, outgoing: 0, blocked: 1 });
  });
  it("unblocks without restoring friendships or requests, and refreshes inactive tabs", async () => {
    const { hook, profiles, requests, queries, fetcher } = await setup();
    await act(async () => { await hook.result.current.mutateAsync({ action: "block", id: friend.id }); });
    fetcher.mockClear();
    await act(async () => { await hook.result.current.mutateAsync({ action: "unblock", id: friend.id }); });
    expect(profiles("friends")).toEqual([]);
    expect(profiles("blocked")).toEqual([]);
    expect(requests()).toEqual([]);
    expect(queries.getQueryData(key("summary"))).toMatchObject({ friends: 0, blocked: 0 });
    expect(screen.getByRole("button", { name: "Add Friend" })).toBeInTheDocument();
    for (const path of ["/friends?", "/friends/requests?", "/users/blocked?", "/friends/summary"]) expect(fetcher.mock.calls.some(([url]) => url.includes(path))).toBe(true);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(1);
  });
  it("does not remove a friend or change caches when blocking fails", async () => {
    const { hook, profiles } = await setup({ fail: true });
    await act(async () => { await expect(hook.result.current.mutateAsync({ action: "block", id: friend.id })).rejects.toBeDefined(); });
    expect(profiles("friends")).toEqual([friend]);
    expect(profiles("blocked")).toEqual([]);
    expect(screen.getByRole("button", { name: "Remove Friend" })).toBeInTheDocument();
  });
  it("keeps one blocked entry on repeated success", async () => {
    const { hook, profiles } = await setup();
    for (let index = 0; index < 2; index++) await act(async () => { await hook.result.current.mutateAsync({ action: "block", id: friend.id }); });
    expect(profiles("blocked")).toEqual([friend]);
    expect(profiles("friends")).toEqual([]);
  });
});
