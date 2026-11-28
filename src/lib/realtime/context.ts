import { createContext, useContext, useEffect } from "react";
import type { ConversationRef, RealtimeClient, RealtimeState } from "./RealtimeClient";
export interface TypingUser { id: string; name: string; expires: number }
export const RealtimeContext = createContext<{ client: RealtimeClient; state: RealtimeState; subscribed: ReadonlySet<string>; typing: Record<string, TypingUser[]> } | null>(null);
export function useRealtimeConversation(type: ConversationRef["type"], id?: string) {
  const realtime = useContext(RealtimeContext);
  useEffect(() => id ? realtime?.client.subscribe({ type, id }) : undefined, [realtime?.client, type, id]);
  return realtime?.state === "connected" && Boolean(id && realtime.subscribed.has(id));
}
