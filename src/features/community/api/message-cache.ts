import type { InfiniteData } from "@tanstack/react-query";
import type { Message, MessageCursor, MessagePage } from "@/lib/api/types";

type History = InfiniteData<MessagePage, MessageCursor | null>;

/** Keep cursor boundaries and older pages intact when a send is confirmed. */
export function mergeConfirmedMessage(
  previous: History | undefined,
  message: Message,
): History | undefined {
  // Never recreate a cleared session's cache after logout or an account switch.
  if (!previous || previous.pages.length === 0) return previous;
  const matches = (item: Message) =>
    item.id === message.id ||
    (item.author_id === message.author_id &&
      item.client_nonce === message.client_nonce);
  const exists = previous.pages.some((page) => page.items.some(matches));
  let inserted = false;
  const pages = previous.pages.map((page, index) => {
    const items = page.items.flatMap((item) => {
      if (!matches(item)) return [item];
      if (inserted) return [];
      inserted = true;
      return [message];
    });
    if (!exists && index === 0) items.unshift(message);
    return { ...page, items };
  });
  return { ...previous, pages };
}

/** Updates an existing message in place across all loaded pages without inserting a new row. */
export function updateCachedMessage(
  previous: History | undefined,
  messageId: string,
  updater: (message: Message) => Message,
): History | undefined {
  if (!previous || previous.pages.length === 0) return previous;
  const pages = previous.pages.map((page) => ({
    ...page,
    items: page.items.map((item) => (item.id === messageId ? updater(item) : item)),
  }));
  return { ...previous, pages };
}
