import { afterEach, describe, expect, it, vi } from "vitest";
import { RealtimeClient } from "./RealtimeClient";

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  sent: string[] = [];
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  onerror?: () => void;
  constructor(readonly url: URL, readonly protocols: string[]) { Socket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
  close(code = 1006) { this.readyState = 3; this.onclose?.({ code }); }
  event(type: string, event_id: string = crypto.randomUUID()) {
    this.onmessage?.({ data: JSON.stringify({ version: 1, type, event_id, seq: 1, conversation: null, data: {} }) });
  }
}
function setup() {
  vi.useFakeTimers();
  Socket.instances = [];
  vi.stubGlobal("WebSocket", Socket);
  const ticket = vi.fn(async () => ({ ticket: "a".repeat(64), url: "/api/v1/realtime" }));
  const event = vi.fn(), state = vi.fn();
  const client = new RealtimeClient(ticket, event, state);
  return { client, ticket, event, state };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("session realtime transport", () => {
  it("shares one socket, deduplicates events and reference counts subscriptions", async () => {
    const { client, event } = setup();
    client.start(); client.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(Socket.instances).toHaveLength(1);
    const socket = Socket.instances[0]!;
    socket.event("session.ready");
    const ref = { type: "channel", id: "channel" } as const;
    const a = client.subscribe(ref), b = client.subscribe(ref);
    expect(socket.sent).toHaveLength(1);
    socket.event("message.created", "duplicate"); socket.event("message.created", "duplicate");
    expect(event).toHaveBeenCalledTimes(2);
    a(); expect(socket.sent).toHaveLength(1);
    b(); expect(socket.sent.map(s => JSON.parse(s).type)).toContain("conversation.unsubscribe");
    expect(socket.url.search).toBe("");
    expect(socket.protocols[1]).toBe(`core.ticket.${"a".repeat(64)}`);
    client.stop();
  });
  it("reconnects with a fresh ticket, restores subscriptions and stops after logout", async () => {
    const { client, ticket } = setup();
    client.subscribe({ type: "thread", id: "thread" });
    client.start(); await vi.advanceTimersByTimeAsync(0);
    Socket.instances[0]!.event("session.ready");
    Socket.instances[0]!.close();
    expect(client.state).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(1000);
    expect(ticket).toHaveBeenCalledTimes(2);
    const socket = Socket.instances[1]!;
    socket.event("session.ready");
    expect(JSON.parse(socket.sent[0]!).data.conversation_id).toBe("thread");
    client.stop(); await vi.advanceTimersByTimeAsync(120_000);
    expect(ticket).toHaveBeenCalledTimes(2);
  });
  it("does not reconnect revoked sessions or open a socket after a delayed logout", async () => {
    const { client, ticket } = setup();
    client.start(); client.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(Socket.instances).toHaveLength(0);
    client.start(); await vi.advanceTimersByTimeAsync(0);
    Socket.instances[0]!.close(4401);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(client.state).toBe("authentication_failed");
    expect(ticket).toHaveBeenCalledTimes(2);
  });
});
