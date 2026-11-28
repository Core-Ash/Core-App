import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { parseMessage } from "@/lib/api/contracts";
import type { MessageCursor, MessagePage } from "@/lib/api/types";
import { mergeConfirmedMessage } from "@/features/community/api/message-cache";
import type { ConversationRef, RealtimeEvent } from "./RealtimeClient";

type History = InfiniteData<MessagePage, MessageCursor | null>;
export function historyKey(ref: ConversationRef) {
  return [ref.type === "channel" ? "messages" : ref.type === "thread" ? "thread-messages" : "conversation-messages", ref.id];
}
export function applyMessageEvent(queries: QueryClient, event: RealtimeEvent) {
  const ref = event.conversation;
  if (!ref || typeof ref.id !== "string") return;
  const key = historyKey(ref);
  if (event.type === "message.deleted") {
    const data = event.data as { id?: string; deleted_at?: string };
    if (typeof data?.id !== "string" || typeof data.deleted_at !== "string") return;
    queries.setQueryData<History>(key, old => old && ({ ...old, pages: old.pages.map(page => ({ ...page, items: page.items.map(message => {
      if (message.id === data.id) return { ...message, body: null, mentions: [], attachments: [], reactions: [], forwarded: null, deleted_at: data.deleted_at! };
      if (message.reply_to && message.reply_to.id === data.id) return { ...message, reply_to: { ...message.reply_to, body: null, deleted: true } };
      return message;
    }) })) }));
    return;
  }
  const message = parseMessage(event.data);
  queries.setQueryData<History>(key, old => {
    const existing = old?.pages.flatMap(p => p.items).find(m => m.id === message.id);
    if (event.type.startsWith("reaction.")) {
      if (!existing || existing.deleted_at) return old;
      return old && { ...old, pages: old.pages.map(page => ({ ...page, items: page.items.map(m => m.id === message.id ? { ...m, reactions: message.reactions } : m) })) };
    }
    // Deletions are terminal; old HTTP/WS edits cannot resurrect them.
    if (existing?.deleted_at || (existing?.edited_at && (!message.edited_at || existing.edited_at > message.edited_at))) return old;
    if (event.type !== "message.created" && !existing) return old;
    const next = mergeConfirmedMessage(old, message);
    return next && { ...next, pages: next.pages.map(p => ({ ...p, items: p.items.map(m => m.reply_to && m.reply_to.id === message.id ? { ...m, reply_to: { ...m.reply_to, body: message.body } } : m) })) };
  });
  // Keep the local outbox until HTTP settles. Rendering already reconciles by nonce.
}
