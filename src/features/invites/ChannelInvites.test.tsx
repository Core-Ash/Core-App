import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AppDataContext } from "@/app/app-data-context";
import { createApiClient } from "@/lib/api/client";
import { inviteKeys, useCreateInvite, useInvitePermissions } from "./api";

afterEach(() => vi.unstubAllGlobals());
const created = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: "a".repeat(64), url: `https://core.test/invite/${"a".repeat(64)}`, expires_at: null, max_uses: null, uses: 0 };
function setup() {
  const fetcher = vi.fn(async (url: string) => Response.json(url.includes("invite-permissions") ? { create: true, manage: false, manage_channels: false, owner: false } : created));
  vi.stubGlobal("fetch", fetcher);
  const api = createApiClient({ baseUrl: "https://core.test", sessionSignal: () => new AbortController().signal, onUnauthorized: async () => "active" });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={queries}><AppDataContext.Provider value={{ api, ready: true, configured: true, configurationError: null, clearPrivateData: vi.fn() }}>{children}</AppDataContext.Provider></QueryClientProvider>; }
  return { fetcher, queries, wrapper: Wrapper };
}
it("loads effective invite permissions for the requested channel", async () => {
  const { fetcher, wrapper } = setup();
  const { result } = renderHook(() => useInvitePermissions("server", "channel"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(fetcher.mock.calls[0]![0]).toContain("/communities/server/invite-permissions?channel_id=channel");
  expect(result.current.data?.create).toBe(true);
});
it("sends channel context and keeps channel links separate from server links", async () => {
  const { fetcher, queries, wrapper } = setup();
  queries.setQueryData(inviteKeys.link("server"), { ...created, id: "server-link" });
  const { result } = renderHook(() => useCreateInvite("server", "channel"), { wrapper });
  await act(async () => { await result.current.mutateAsync({ expires_in_seconds: null, max_uses: null }); });
  const options = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
  expect(JSON.parse(options.body as string)).toEqual({ expires_in_seconds: null, max_uses: null, channel_id: "channel" });
  expect(queries.getQueryData(inviteKeys.link("server"))).toMatchObject({ id: "server-link" });
  expect(queries.getQueryData(inviteKeys.link("server", "channel"))).toMatchObject({ id: created.id });
});
