import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { parseList, parseProfile, parsePublicProfile, record, timestamp, uuid } from "@/lib/api/contracts";
import { ApiError } from "@/lib/api/errors";
import type { PublicProfile } from "@/lib/api/types";
import { queryKeys, useCurrentUser } from "@/features/community/api/hooks";

export interface FriendRequest { id: string; incoming: boolean; created_at: string; profile: PublicProfile }
export type ListKind = "friends" | "requests" | "blocked";
export interface FriendPage<T> { items: T[]; next_cursor: string | null }
export function parseRequest(value: unknown): FriendRequest {
  const data = record(value);
  if (typeof data.incoming !== "boolean") throw new ApiError("invalid_response");
  return { id: uuid(data.id), incoming: data.incoming, created_at: timestamp(data.created_at), profile: parsePublicProfile(data.profile) };
}
export function parseFriendPage<T>(value: unknown, parse: (value: unknown) => T): FriendPage<T> {
  const data = record(value);
  return { items: parseList(value, parse), next_cursor: data.next_cursor === null ? null : uuid(data.next_cursor) };
}
const paths = { friends: "/friends", requests: "/friends/requests", blocked: "/users/blocked" };
export function useFriendCounts() {
  const { api, ready } = useAppData();
  const me = useCurrentUser();
  return useQuery({ queryKey: ["relationships", "summary"], enabled: ready && me.isSuccess,
    queryFn: async ({ signal }) => {
      const data = record(await api.get("/friends/summary", { signal }));
      for (const key of ["friends", "incoming", "outgoing", "blocked"]) if (typeof data[key] !== "number" || !Number.isSafeInteger(data[key]) || (data[key] as number) < 0) throw new ApiError("invalid_response");
      return { friends: data.friends as number, incoming: data.incoming as number, outgoing: data.outgoing as number, blocked: data.blocked as number };
    }, staleTime: 15_000, refetchOnMount: "always", refetchOnWindowFocus: true,
  });
}
export function useFriendList<K extends ListKind>(kind: K, enabled = true) {
  const { api, ready } = useAppData();
  const me = useCurrentUser();
  return useInfiniteQuery({
    queryKey: ["relationships", kind], enabled: ready && me.isSuccess && enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => parseFriendPage(
      await api.get(paths[kind], { signal, query: { after_id: pageParam ?? undefined, limit: 50 } }),
      (kind === "requests" ? parseRequest : parsePublicProfile) as (v: unknown) => K extends "requests" ? FriendRequest : PublicProfile,
    ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    refetchOnMount: "always", refetchOnWindowFocus: true, staleTime: 15_000,
  });
}
export type Relationship = { state: "none" | "self" | "friends" | "blocked" | "incoming" | "outgoing"; request_id: string | null };
export function useRelationship(id: string, enabled = true) {
  const { api, ready } = useAppData();
  return useQuery({ queryKey: ["relationships", "user", id], enabled: ready && enabled,
    queryFn: async ({ signal }): Promise<Relationship> => {
      const data = record(await api.get(`/friends/${id}/relationship`, { signal }));
      if (!["none", "self", "friends", "blocked", "incoming", "outgoing"].includes(String(data.state))) throw new ApiError("invalid_response");
      return { state: data.state as Relationship["state"], request_id: data.request_id === null ? null : uuid(data.request_id) };
    }, staleTime: 0,
  });
}
export type FriendAction = { action: "send"; username: string } | { action: "accept" | "decline" | "cancel" | "remove" | "block" | "unblock"; id: string };
export function useFriendAction() {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (input: FriendAction) => {
      if (!ready) throw new ApiError("unauthorized");
      switch (input.action) {
        case "send": {
          const data = record(await api.post("/friends/requests", { username: input.username.trim() }));
          uuid(data.id);
          if (data.status !== "accepted" && data.status !== "pending") throw new ApiError("invalid_response");
          return data.status;
        }
        case "accept": case "decline": await api.post(`/friends/requests/${input.id}/${input.action}`); break;
        case "cancel": await api.delete(`/friends/requests/${input.id}`); break;
        case "remove": await api.delete(`/friends/${input.id}`); break;
        case "block": await api.post(`/users/${input.id}/block`); break;
        case "unblock": await api.delete(`/users/${input.id}/block`); break;
      }
    },
    onSuccess: () => queries.invalidateQueries({ queryKey: ["relationships"] }),
    onError: () => queries.invalidateQueries({ queryKey: ["relationships"] }),
  });
}
export function useRenameUsername() {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({ mutationFn: async (username: string) => {
    if (!ready) throw new ApiError("unauthorized");
    return parseProfile(await api.patch("/me/username", { username: username.trim() }));
  }, onSuccess: async (profile) => {
    queries.setQueryData(queryKeys.profile, profile);
    await queries.invalidateQueries({ predicate: (query) => ["members", "messages", "channel-access", "relationships"].includes(String(query.queryKey[0])) });
  } });
}
