import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { messageFixture } from "@/test/api-fixtures";
import { applyMessageEvent, historyKey } from "./cache";
import type { RealtimeEvent } from "./RealtimeClient";
import type { MessagePage } from "@/lib/api/types";

const ref = { type: "channel", id: "channel" } as const;
const key = historyKey(ref);
function event(type: string, data: unknown): RealtimeEvent { return { version: 1, type, event_id: crypto.randomUUID(), seq: 1, conversation: ref, data }; }
function setup() {
  const queries = new QueryClient();
  queries.setQueryData(key, { pages: [{ items: [messageFixture], next_cursor: null }], pageParams: [null] });
  const messages = () => queries.getQueryData<{ pages: MessagePage[] }>(key)!.pages.flatMap(p => p.items);
  return { queries, messages };
}
describe("realtime message reconciliation", () => {
  it("merges a websocket echo before or after HTTP confirmation without duplicates", () => {
    const { queries, messages } = setup();
    applyMessageEvent(queries, event("message.created", messageFixture));
    applyMessageEvent(queries, event("message.created", messageFixture));
    expect(messages()).toHaveLength(1);
  });
  it("keeps newer edits and never resurrects deleted messages", () => {
    const { queries, messages } = setup();
    const newer = { ...messageFixture, body: "new", edited_at: "2026-11-28T12:00:00Z" };
    applyMessageEvent(queries, event("message.updated", newer));
    applyMessageEvent(queries, event("message.updated", messageFixture));
    expect(messages()[0]!.body).toBe("new");
    applyMessageEvent(queries, event("message.deleted", { id: newer.id, deleted_at: "2026-11-28T12:01:00Z" }));
    applyMessageEvent(queries, event("message.created", newer));
    expect(messages()[0]!.body).toBeNull();
    expect(messages()[0]!.deleted_at).toBeTruthy();
  });
  it("replaces authoritative reaction counts rather than incrementing duplicate events", () => {
    const { queries, messages } = setup();
    const reaction = { ...messageFixture, reactions: [{ emoji: "👍", emoji_name: null, emoji_url: null, count: 1, me: false, users: [] }] };
    applyMessageEvent(queries, event("reaction.added", reaction));
    applyMessageEvent(queries, event("reaction.added", reaction));
    expect(messages()[0]!.reactions?.[0]?.count).toBe(1);
    queries.clear();
    applyMessageEvent(queries, event("message.created", reaction));
    expect(queries.getQueryData(key)).toBeUndefined();
  });
  it("applies reaction snapshots without reverting a newer content edit", () => {
    const { queries, messages } = setup();
    applyMessageEvent(queries, event("message.updated", { ...messageFixture, body: "New content", edited_at: "2026-11-28T12:00:00Z" }));
    applyMessageEvent(queries, event("reaction.added", { ...messageFixture, reactions: [{ emoji: "👍", count: 2, me: true, users: [] }] }));
    expect(messages()[0]!.body).toBe("New content");
    expect(messages()[0]!.reactions?.[0]?.count).toBe(2);
  });
});
