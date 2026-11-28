import { useContext, useEffect, useRef } from "react";
import { RealtimeContext } from "./context";
import type { ConversationRef } from "./RealtimeClient";

export function useTyping(ref: ConversationRef | undefined, draft: string) {
  const realtime = useContext(RealtimeContext);
  const client = realtime?.client;
  const id = ref?.id, type = ref?.type;
  const last = useRef(0);
  useEffect(() => {
    if (!id || !type || !client) return;
    const conversation = { id, type };
    if (!draft) { client.send("typing.stopped", conversation); return; }
    if (Date.now() - last.current > 2500) {
      client.send("typing.started", conversation);
      last.current = Date.now();
    }
    const timer = setTimeout(() => client.send("typing.stopped", conversation), 4000);
    return () => clearTimeout(timer);
  }, [draft, id, type, client]);
  useEffect(() => () => { if (id && type) client?.send("typing.stopped", { id, type }); }, [id, type, client]);
  return ref ? (realtime?.typing[ref.id] ?? []).map(u => u.name) : [];
}
