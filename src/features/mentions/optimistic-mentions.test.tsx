import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataContext } from "@/app/app-data-context";
import { useSendMessage } from "@/features/community/api/hooks";
import { useSendConversationMessage } from "@/features/conversations/api";
import { createApiClient } from "@/lib/api/client";
import { channelFixture, messageFixture, profileFixture } from "@/test/api-fixtures";
import type { Mention } from "./model";

afterEach(() => vi.unstubAllGlobals());
describe.each(["channel", "conversation"] as const)("%s optimistic mentions", (kind) => {
  function setup() {
    const requests: { finish: (response: Response) => void; body: { body: string; mentions: Mention[]; client_nonce: string } }[] = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => new Promise<Response>((finish) => requests.push({ finish, body: JSON.parse(options.body as string) }))));
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
    queries.setQueryData(["profile"], profileFixture);
    queries.setQueryData([kind === "channel" ? "messages" : "conversation-messages", channelFixture.id], { pages: [{ items: [], next_cursor: null }], pageParams: [null] });
    const api = createApiClient({ baseUrl: "/api/v1", sessionSignal: () => new AbortController().signal, onUnauthorized: async () => "active" });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queries}><AppDataContext.Provider value={{ api, ready: true, configured: true, configurationError: null, clearPrivateData: vi.fn() }}>{children}</AppDataContext.Provider></QueryClientProvider>;
    const useSend = kind === "channel" ? useSendMessage : useSendConversationMessage;
    const hook = renderHook(() => useSend(channelFixture.id), { wrapper });
    return { ...hook, queries, requests };
  }
  const mention: Mention = { kind: "user", id: profileFixture.id, start: 0, end: 4, label: "Ash", profile: profileFixture };
  it("renders metadata immediately and reconciles with authoritative current labels", async () => {
    const { result, requests, queries } = setup();
    act(() => result.current.send("@Ash", [mention]));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(result.current.entries[0]?.message.mentions).toEqual([mention]);
    expect(requests[0]!.body.mentions).toEqual([{ kind: "user", id: profileFixture.id, start: 0, end: 4 }]);
    await act(async () => requests[0]!.finish(Response.json({ ...messageFixture, body: "@Ash", client_nonce: requests[0]!.body.client_nonce, mentions: [{ ...mention, label: "Renamed" }] })));
    await waitFor(() => expect(result.current.entries).toHaveLength(0));
    const history = queries.getQueryData<{ pages: { items: { mentions: Mention[] }[] }[] }>([kind === "channel" ? "messages" : "conversation-messages", channelFixture.id]);
    expect(history?.pages[0]?.items[0]?.mentions[0]?.label).toBe("Renamed");
  });
  it("retains failed mention drafts and retries with the same identity and nonce", async () => {
    const { result, requests } = setup();
    act(() => result.current.send("@Ash", [mention]));
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => requests[0]!.finish(new Response(null, { status: 503 })));
    await waitFor(() => expect(result.current.entries[0]?.status).toBe("failed"));
    expect(result.current.entries[0]?.message.mentions).toEqual([mention]);
    act(() => result.current.retry(requests[0]!.body.client_nonce));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]!.body).toEqual(requests[0]!.body);
    await act(async () => requests[1]!.finish(Response.json({ ...messageFixture, body: "@Ash", client_nonce: requests[1]!.body.client_nonce, mentions: [mention] })));
    await waitFor(() => expect(result.current.entries).toHaveLength(0));
  });
});
