import { describe, expect, it } from "vitest";
import { mergeConfirmedMessage } from "./message-cache";
import { messageFixture } from "@/test/api-fixtures";
import type { InfiniteData } from "@tanstack/react-query";
import type { MessageCursor, MessagePage } from "@/lib/api/types";

const cursor = {
  before_time: messageFixture.created_at,
  before_id: messageFixture.id,
};
const history: InfiniteData<MessagePage, MessageCursor | null> = {
  pages: [
    { items: [messageFixture], next_cursor: cursor },
    { items: [{ ...messageFixture, id: "older", client_nonce: "older-nonce" }], next_cursor: null },
  ],
  pageParams: [null, cursor],
};

describe("confirmed message cache", () => {
  it("inserts a confirmed send without dropping loaded history or cursor boundaries", () => {
    const message = { ...messageFixture, id: "new", client_nonce: "new-nonce", body: "Confirmed" };
    const merged = mergeConfirmedMessage(history, message)!;
    expect(merged.pages[0]!.items).toEqual([message, messageFixture]);
    expect(merged.pages[1]).toEqual(history.pages[1]);
    expect(merged.pages[0]!.next_cursor).toBe(cursor);
    expect(merged.pageParams).toBe(history.pageParams);
    expect(history.pages[0]!.items).toEqual([messageFixture]);
  });
  it("deduplicates retries by id or author/nonce, including messages on older pages", () => {
    const confirmed = { ...history.pages[1]!.items[0]!, body: "Confirmed retry" };
    const merged = mergeConfirmedMessage(history, confirmed)!;
    expect(merged.pages[0]).toEqual(history.pages[0]);
    expect(merged.pages[1]!.items).toEqual([confirmed]);
    const withDuplicate = { ...merged, pages: [{ ...merged.pages[0]!, items: [confirmed] }, merged.pages[1]!] };
    const retried = mergeConfirmedMessage(withDuplicate, { ...confirmed, id: "canonical-id" })!;
    expect(retried.pages.flatMap((page) => page.items)).toEqual([{ ...confirmed, id: "canonical-id" }]);
  });
  it("does not confuse different authors sharing a nonce", () => {
    const message = { ...messageFixture, id: "new", author_id: "another-author" };
    expect(mergeConfirmedMessage(history, message)!.pages[0]!.items).toEqual([message, messageFixture]);
  });
  it("never recreates private data after the session cache was cleared", () => {
    expect(mergeConfirmedMessage(undefined, messageFixture)).toBeUndefined();
  });
});
