export type ConversationRef = { type: "channel" | "direct" | "group" | "thread"; id: string };
export type RealtimeState = "connecting" | "connected" | "reconnecting" | "disconnected" | "authentication_failed";
export interface RealtimeEvent {
  version: 1;
  type: string;
  event_id: string;
  seq: number;
  conversation: ConversationRef | null;
  data: unknown;
}

/** One transport per session scope. Tickets and events are never persisted. */
export class RealtimeClient {
  private socket: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private watchdog: ReturnType<typeof setInterval> | undefined;
  private generation = 0;
  private attempt = 0;
  private active = false;
  private lastSeen = 0;
  private subscriptions = new Map<string, { ref: ConversationRef; count: number }>();
  private seen = new Set<string>();
  state: RealtimeState = "disconnected";
  constructor(
    private readonly ticket: () => Promise<{ ticket: string; url: string }>,
    private readonly onEvent: (event: RealtimeEvent, client: RealtimeClient) => void,
    private readonly onState: (state: RealtimeState) => void,
  ) {}
  private setState(state: RealtimeState) { this.state = state; this.onState(state); }
  start() {
    if (this.active || typeof WebSocket === "undefined") return;
    this.active = true;
    void this.connect();
  }
  stop() {
    this.active = false;
    this.generation++;
    clearTimeout(this.timer);
    clearInterval(this.watchdog);
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "session_ended");
    this.seen.clear();
    this.setState("disconnected");
  }
  subscribe(ref: ConversationRef) {
    const key = `${ref.type}:${ref.id}`;
    const existing = this.subscriptions.get(key);
    if (existing) existing.count++;
    else {
      this.subscriptions.set(key, { ref, count: 1 });
      this.send("conversation.subscribe", ref);
    }
    return () => {
      const entry = this.subscriptions.get(key);
      if (entry && --entry.count === 0) {
        this.send("typing.stopped", ref);
        this.send("conversation.unsubscribe", ref);
        this.subscriptions.delete(key);
      }
    };
  }
  send(type: string, ref: ConversationRef) {
    if (this.state !== "connected" || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ version: 1, type, data: { conversation_type: ref.type, conversation_id: ref.id } }));
  }
  resynchronize() { this.socket?.close(4000, "resync_required"); }
  private async connect() {
    const generation = ++this.generation;
    this.setState(this.attempt ? "reconnecting" : "connecting");
    try {
      const ticket = await this.ticket();
      if (!this.active || generation !== this.generation) return;
      if (!/^[a-f0-9]{64}$/.test(ticket.ticket)) throw new Error("Invalid ticket");
      const url = new URL(ticket.url, location.href);
      if (url.protocol === "https:") url.protocol = "wss:";
      if (url.protocol === "http:") url.protocol = "ws:";
      if (!['ws:', 'wss:'].includes(url.protocol) || (location.protocol === "https:" && url.protocol !== "wss:") || url.username || url.password || url.search || url.hash) throw new Error("Invalid realtime URL");
      const socket = new WebSocket(url, ["core.v1", `core.ticket.${ticket.ticket}`]);
      this.socket = socket;
      this.lastSeen = Date.now();
      this.watchdog = setInterval(() => {
        if (Date.now() - this.lastSeen > 90_000) socket.close(4000, "heartbeat_timeout");
        else if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
      }, 15_000);
      socket.onmessage = ({ data }: MessageEvent<unknown>) => {
        if (!this.active || generation !== this.generation || typeof data !== "string" || data.length > 4_194_304) return;
        try {
          const event = JSON.parse(data) as RealtimeEvent;
          if (event.version !== 1 || typeof event.type !== "string" || typeof event.event_id !== "string" || !Number.isSafeInteger(event.seq)) return;
          this.lastSeen = Date.now();
          if (this.seen.has(event.event_id)) return;
          if (event.type === "session.ready") {
            this.attempt = 0;
            this.seen.clear();
            this.setState("connected");
            for (const { ref } of this.subscriptions.values()) this.send("conversation.subscribe", ref);
          }
          this.seen.add(event.event_id);
          if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
          this.onEvent(event, this);
        } catch { /* Invalid events never enter application caches. */ }
      };
      socket.onclose = ({ code }) => {
        if (generation !== this.generation) return;
        clearInterval(this.watchdog);
        this.socket = null;
        if (code === 4401 || code === 4403) {
          this.active = false;
          this.setState("authentication_failed");
        } else this.retry();
      };
      socket.onerror = () => socket.close();
    } catch (error) {
      if (generation !== this.generation) return;
      if (error && typeof error === "object" && "status" in error && error.status === 401 && !("kind" in error && ["session_transport", "auth_unavailable"].includes(String(error.kind)))) {
        this.active = false;
        this.setState("authentication_failed");
      } else this.retry();
    }
  }
  private retry() {
    if (!this.active) return;
    this.setState("reconnecting");
    this.timer = setTimeout(() => void this.connect(), Math.min(30_000, 500 * 2 ** Math.min(this.attempt++, 6)) * (0.75 + Math.random() * 0.5));
  }
}
