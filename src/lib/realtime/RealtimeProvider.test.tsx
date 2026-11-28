import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { AppDataContext } from "@/app/app-data-context";
import { createApiClient } from "@/lib/api/client";
import { useMessages } from "@/features/community/api/hooks";
import { channelFixture, messageFixture, profileFixture } from "@/test/api-fixtures";
import { RealtimeProvider } from "./RealtimeProvider";

class Socket {
  static OPEN = 1;
  static instance: Socket;
  readyState = 1;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  onerror?: () => void;
  sent: string[] = [];
  constructor() { Socket.instance = this; }
  send(data: string) { this.sent.push(data); }
  close(code = 1000) { this.onclose?.({ code }); }
  event(type: string, data: unknown = {}, seq = 1) {
    this.onmessage?.({ data: JSON.stringify({ version: 1, type, event_id: crypto.randomUUID(), seq, conversation: type === "session.ready" ? null : { type: "channel", id: channelFixture.id }, data }) });
  }
}
function History() {
  const history = useMessages(channelFixture.id);
  return <div>{history.data?.pages.flatMap(p => p.items).map(m => <p key={m.id}>{m.body ?? "Deleted"}</p>)}</div>;
}
afterEach(() => vi.unstubAllGlobals());

it("buffers events during subscribe-then-fetch and removes history after revocation", async () => {
  vi.stubGlobal("WebSocket", Socket);
  let finish: ((response: Response) => void) | undefined;
  let historyCalls = 0;
  const request = vi.fn(async (url: string) => {
    if (url.endsWith("/realtime/ticket")) return Response.json({ ticket: "b".repeat(64), url: "/api/v1/realtime" });
    if (url.includes("/messages")) {
      historyCalls++;
      if (historyCalls > 1) return new Promise<Response>(resolve => { finish = resolve; });
      return Response.json({ items: [messageFixture], next_cursor: null });
    }
    return Response.json({ items: [] });
  });
  vi.stubGlobal("fetch", request);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  queries.setQueryData(["profile"], profileFixture);
  const controller = new AbortController();
  const api = createApiClient({ baseUrl: "/api/v1", sessionSignal: () => controller.signal, onUnauthorized: async () => "active" });
  const view = render(<QueryClientProvider client={queries}><AppDataContext.Provider value={{ api, ready: true, configured: true, configurationError: null, clearPrivateData: () => queries.clear() }}><RealtimeProvider><History /></RealtimeProvider></AppDataContext.Provider></QueryClientProvider>);
  await screen.findByText(messageFixture.body!);
  await waitFor(() => expect(Socket.instance).toBeDefined());
  act(() => Socket.instance.event("session.ready"));
  expect(Socket.instance.sent.some(s => JSON.parse(s).type === "conversation.subscribe")).toBe(true);
  act(() => Socket.instance.event("conversation.subscribed"));
  await waitFor(() => expect(finish).toBeDefined());
  act(() => Socket.instance.event("message.updated", { ...messageFixture, body: "Arrived during synchronization", edited_at: "2026-11-28T12:00:00Z" }, 2));
  await act(async () => finish!(Response.json({ items: [messageFixture], next_cursor: null })));
  await screen.findByText("Arrived during synchronization");
  expect(historyCalls).toBe(2);
  act(() => Socket.instance.event("message.updated", { ...messageFixture, body: "Targeted update", edited_at: "2026-11-28T12:01:00Z" }, 3));
  await screen.findByText("Targeted update");
  expect(historyCalls).toBe(2);
  act(() => Socket.instance.event("message.updated", { ...messageFixture, body: "Newer database edit with a late sequence", edited_at: "2026-11-28T12:02:00Z" }, 2));
  await screen.findByText("Newer database edit with a late sequence");
  act(() => Socket.instance.event("conversation.access_revoked", {}, 4));
  expect(screen.queryByText("Newer database edit with a late sequence")).not.toBeInTheDocument();
  view.unmount(); controller.abort(); queries.clear();
});
