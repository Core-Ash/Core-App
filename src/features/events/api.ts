import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { ApiError } from "@/lib/api/errors";
import { record, string, timestamp, uuid } from "@/lib/api/contracts";

export interface ServerEvent {
  id: string; community_id: string; name: string; description: string; location: string;
  starts_at: string; ends_at: string | null; status: "scheduled" | "cancelled";
  created_at: string; updated_at: string; creator: string;
}
export interface EventInput { name: string; description: string; location: string; starts_at: string; ends_at: string | null }
export interface EventCursor { after_time: string; after_id: string }
export function parseEvent(value: unknown): ServerEvent {
  const data = record(value);
  if (data.status !== "scheduled" && data.status !== "cancelled") throw new ApiError("invalid_response");
  const starts = timestamp(data.starts_at), ends = data.ends_at === null ? null : timestamp(data.ends_at);
  if (ends && Date.parse(ends) <= Date.parse(starts)) throw new ApiError("invalid_response");
  return { id: uuid(data.id), community_id: uuid(data.community_id), name: string(data.name), description: string(data.description), location: string(data.location), starts_at: starts, ends_at: ends, status: data.status, creator: string(data.creator), created_at: timestamp(data.created_at), updated_at: timestamp(data.updated_at) };
}
function scopedEvent(value: unknown, communityId: string, eventId?: string) {
  const event = parseEvent(value);
  if (event.community_id !== communityId || (eventId && event.id !== eventId)) throw new ApiError("invalid_response");
  return event;
}
export const eventKeys = {
  list: (id: string) => ["events", id] as const,
  detail: (id: string, eventId: string) => ["event", id, eventId] as const,
};
export function useEventPermissions(id: string) {
  const { api, ready } = useAppData();
  return useQuery({ queryKey: ["event-permissions", id], enabled: ready && Boolean(id), staleTime: 10_000, refetchOnWindowFocus: true, refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const data = record(await api.get(`/communities/${id}/event-permissions`, { signal }));
      if (typeof data.create !== "boolean" || typeof data.manage !== "boolean") throw new ApiError("invalid_response");
      return { create: data.create, manage: data.manage };
    },
  });
}
export function useEvents(id: string) {
  const { api, ready } = useAppData();
  return useInfiniteQuery({ queryKey: eventKeys.list(id), enabled: ready, initialPageParam: null as EventCursor | null,
    queryFn: async ({ pageParam, signal }): Promise<{ items: ServerEvent[]; next_cursor: EventCursor | null }> => {
      const data = record(await api.get(`/communities/${id}/events`, { signal, query: pageParam ? { ...pageParam } : undefined }));
      if (!Array.isArray(data.items) || data.items.length > 50) throw new ApiError("invalid_response");
      const cursor = data.next_cursor === null ? null : record(data.next_cursor);
      return { items: data.items.map((event) => scopedEvent(event, id)), next_cursor: cursor ? { after_time: timestamp(cursor.after_time), after_id: uuid(cursor.after_id) } : null };
    },
    getNextPageParam: (page: { next_cursor: EventCursor | null }) => page.next_cursor ?? undefined,
    refetchOnWindowFocus: true, refetchInterval: 30_000,
  });
}
export function useEvent(id: string, eventId: string | null) {
  const { api, ready } = useAppData();
  return useQuery({ queryKey: eventKeys.detail(id, eventId ?? ""), enabled: ready && Boolean(eventId),
    queryFn: async ({ signal }) => {
      if (!eventId || !/^[a-f0-9-]{36}$/i.test(eventId)) throw new ApiError("not_found");
      return scopedEvent(await api.get(`/communities/${id}/events/${eventId}`, { signal }), id, eventId);
    }, staleTime: 0, refetchOnWindowFocus: true,
  });
}
export function useSaveEvent(id: string, existing?: ServerEvent) {
  const { api, ready } = useAppData(); const queries = useQueryClient();
  return useMutation({ mutationFn: async ({ input, nonce }: { input: EventInput; nonce: string }) => {
    if (!ready) throw new ApiError("unauthorized");
    const result = existing ? await api.patch(`/communities/${id}/events/${existing.id}`, { ...input })
      : await api.post(`/communities/${id}/events`, { ...input, client_nonce: nonce });
    return scopedEvent(result, id, existing?.id);
  }, onSuccess: async (event) => {
    queries.setQueryData(eventKeys.detail(id, event.id), event);
    await queries.invalidateQueries({ queryKey: eventKeys.list(id) });
  } });
}
export function useCancelEvent(id: string) {
  const { api, ready } = useAppData(); const queries = useQueryClient();
  return useMutation({ mutationFn: async (eventId: string) => {
    if (!ready) throw new ApiError("unauthorized");
    await api.delete(`/communities/${id}/events/${eventId}`);
  }, onSuccess: async (_, eventId) => {
    await Promise.all([queries.invalidateQueries({ queryKey: eventKeys.list(id) }), queries.invalidateQueries({ queryKey: eventKeys.detail(id, eventId) })]);
  } });
}
