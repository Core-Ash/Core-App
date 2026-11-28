import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { AuthContext } from "@/features/auth/auth-context";
import type { ConversationSummary, PublicProfile, ThreadSummary } from "@/lib/api/types";
import { parseMessage, parseThreadSummary } from "@/lib/api/contracts";
import { updateCachedMessage } from "@/features/community/api/message-cache";
import { RealtimeClient, type RealtimeEvent, type RealtimeState } from "./RealtimeClient";
import { RealtimeContext, type TypingUser } from "./context";
import { applyMessageEvent, historyKey } from "./cache";

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { api, ready } = useAppData();
  const auth = useContext(AuthContext);
  const sessionRechecked = useRef(false);
  const profile = useQuery<PublicProfile>({ queryKey: ["profile"], queryFn: skipToken });
  const profileId = profile.data?.id;
  const queries = useQueryClient();
  const [state, setState] = useState<RealtimeState>("disconnected");
  const [typing, setTyping] = useState<Record<string, TypingUser[]>>({});
  const [subscribed, setSubscribed] = useState<ReadonlySet<string>>(new Set());
  const [client] = useState(() => {
    const syncing = new Map<string, RealtimeEvent[]>();
    const versions = new Map<string, number>();
    function apply(event: RealtimeEvent) {
      const data = event.data as { id?: string } | null;
      const versionKey = `${event.conversation?.id}:${data?.id}:${event.type.startsWith("reaction.") ? "reaction" : "message"}`;
      // Content ordering comes from the database's edited_at/deletion state.
      // Concurrent publishers can enqueue a newer edit with a lower process seq.
      if (event.type.startsWith("reaction.") && (versions.get(versionKey) ?? 0) >= event.seq) return;
      versions.set(versionKey, event.seq);
      if (versions.size > 4096) versions.delete(versions.keys().next().value!);
      try { applyMessageEvent(queries, event); } catch { /* DTO validation rejects malformed payloads. */ }
    }
    return new RealtimeClient(
      () => api.post<{ ticket: string; url: string }>("/realtime/ticket"),
      (event, transport) => {
        const ref = event.conversation;
        if (event.type === "session.ready") { syncing.clear(); versions.clear(); setSubscribed(new Set()); void queries.invalidateQueries({ queryKey: ["conversations"] }); }
        if (event.type === "permissions.changed") {
          void queries.invalidateQueries({ queryKey: ["channels"] });
          void queries.invalidateQueries({ queryKey: ["thread"] });
          void queries.invalidateQueries({ queryKey: ["conversations"] });
        }
        if (event.type === "notifications.updated") void queries.invalidateQueries({ queryKey: ["mention-notifications"] });
        if (event.type === "conversation.updated") {
          const data = event.data as { id: string; last_message: unknown; last_message_at: string };
          try {
            const message = parseMessage(data.last_message);
            const list = queries.getQueryData<ConversationSummary[]>(["conversations"]);
            if (list?.some(c => c.id === data.id)) {
              queries.setQueryData<ConversationSummary[]>(["conversations"], old => old?.map(c => c.id === data.id && c.last_message_at <= message.created_at ? { ...c, hidden: false, last_message: { ...message, body: message.body }, last_message_at: message.created_at } : c).sort((a,b) => b.last_message_at.localeCompare(a.last_message_at)));
            } else void queries.invalidateQueries({ queryKey: ["conversations"], exact: true });
          } catch { /* Reject invalid conversation previews. */ }
        }
        if (!ref) return;
        if (event.type.startsWith("typing.")) {
          const data = event.data as { user_id?: string; display_name?: string };
          if (typeof data?.user_id === "string" && typeof data.display_name === "string") {
            const id = data.user_id, name = data.display_name;
            setTyping(old => ({ ...old, [ref.id]: [...(old[ref.id] ?? []).filter(u => u.id !== id && u.expires > Date.now()), ...(event.type === "typing.started" ? [{ id, name, expires: Date.now() + 7000 }] : [])] }));
          }
          return;
        }
        if (event.type.startsWith("thread.")) {
          const data = event.data as { id?: string; thread?: unknown };
          void queries.invalidateQueries({ queryKey: ["thread", data?.id ?? ref.id] });
          if (ref.type === "channel") {
            if (event.type === "thread.deleted") {
              queries.setQueryData<ThreadSummary[]>(["channel-threads", ref.id], old => old?.filter(t => t.id !== data.id));
              queries.setQueryData(historyKey(ref), (old: Parameters<typeof updateCachedMessage>[0]) => {
                const starter = old?.pages.flatMap(p => p.items).find(m => m.thread?.id === data.id);
                return starter ? updateCachedMessage(old, starter.id, m => ({ ...m, thread: null })) : old;
              });
            } else if (data.thread) {
              try {
                const thread = parseThreadSummary(data.thread);
                queries.setQueryData<ThreadSummary[]>(["channel-threads", ref.id], old => old && [thread, ...old.filter(t => t.id !== thread.id)].sort((a,b) => b.last_activity_at.localeCompare(a.last_activity_at)));
                if (thread.starter_message_id) queries.setQueryData(historyKey(ref), (old: Parameters<typeof updateCachedMessage>[0]) => updateCachedMessage(old, thread.starter_message_id!, m => ({ ...m, thread })));
              } catch { /* Malformed summaries cannot alter the message cache. */ }
            } else void queries.invalidateQueries({ queryKey: ["channel-threads", ref.id] });
          }
          return;
        }
        if (event.type === "conversation.access_revoked" || (event.type === "error" && (event.data as { code?: string })?.code === "forbidden")) {
          syncing.delete(ref.id);
          setSubscribed(old => new Set([...old].filter(id => id !== ref.id)));
          void queries.cancelQueries({ queryKey: historyKey(ref) });
          queries.setQueryData(historyKey(ref), { pages: [{ items: [], next_cursor: null }], pageParams: [null] });
          void queries.invalidateQueries({ queryKey: ["channels"] });
          void queries.invalidateQueries({ queryKey: ["conversations"] });
          return;
        }
        if (event.type === "conversation.subscribed" || event.type === "conversation.resync") {
          setSubscribed(old => new Set([...old, ref.id]));
          const buffer: RealtimeEvent[] = [];
          syncing.set(ref.id, buffer);
          void (async () => {
            await queries.cancelQueries({ queryKey: historyKey(ref) });
            await queries.invalidateQueries({ queryKey: historyKey(ref) });
            if (syncing.get(ref.id) !== buffer) return;
            syncing.delete(ref.id);
            for (const item of buffer) apply(item);
          })();
          return;
        }
        if (event.type.startsWith("message.") || event.type.startsWith("reaction.")) {
          if (event.type === "message.created") {
            const author = (event.data as { author_id?: string })?.author_id;
            setTyping(old => old[ref.id]?.some(u => u.id === author) ? { ...old, [ref.id]: old[ref.id]!.filter(u => u.id !== author) } : old);
          }
          const buffer = syncing.get(ref.id);
          if (buffer) { if (buffer.length < 512) buffer.push(event); else transport.resynchronize(); }
          else apply(event);
        }
      }, next => { setState(next); if (next !== "connected") { setSubscribed(new Set()); setTyping({}); } },
    );
  });
  useEffect(() => {
    if (ready && profileId) client.start();
    return () => client.stop();
  }, [client, ready, profileId]);
  useEffect(() => {
    if (state !== "authentication_failed") sessionRechecked.current = false;
    else if (!sessionRechecked.current && auth) { sessionRechecked.current = true; void auth.refresh(); }
  }, [state, auth]);
  useEffect(() => {
    const timer = setInterval(() => setTyping(old => {
      if (!Object.values(old).some(users => users.some(u => u.expires <= Date.now()))) return old;
      return Object.fromEntries(Object.entries(old).map(([id, users]) => [id, users.filter(u => u.expires > Date.now())]).filter(([, users]) => (users as TypingUser[]).length));
    }), 1000);
    return () => clearInterval(timer);
  }, []);
  return <RealtimeContext.Provider value={{ client, state, subscribed, typing }}>{children}</RealtimeContext.Provider>;
}
