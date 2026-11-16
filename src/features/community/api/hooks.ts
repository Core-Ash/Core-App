import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { ApiError, apiErrorMessage } from "@/lib/api/errors";
import { endpoints } from "@/lib/api/endpoints";
import { mergeConfirmedMessage } from "@/features/community/api/message-cache";
import type { ChannelAccessFilters, MessageCursor, Message } from "@/lib/api/types";

export const queryKeys = {
  profile: ["profile"] as const,
  communities: ["communities"] as const,
  channels: (communityId: string | undefined) =>
    ["channels", communityId] as const,
  messages: (channelId: string | undefined) => ["messages", channelId] as const,
  channelAccess: (communityId: string) => ["channel-access", communityId] as const,
  members: (communityId: string) => ["members", communityId] as const,
};

export function useCurrentUser() {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async ({ signal }) => {
      const result = await endpoints.bootstrap(api, signal);
      queries.setQueryData(queryKeys.communities, result.communities);
      return result.profile;
    },
    enabled: ready,
  });
}
export function useCreateProfile() {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!ready) throw new ApiError("unauthorized");
      return endpoints.createProfile(api);
    },
    onSuccess: (profile) => {
      queries.setQueryData(queryKeys.profile, profile);
    },
  });
}
export function useCommunities() {
  const { api, ready } = useAppData();
  const profile = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.communities,
    queryFn: ({ signal }) => endpoints.communities(api, signal),
    enabled: ready && profile.isSuccess,
  });
}
export function useChannels(communityId?: string) {
  const { api, ready } = useAppData();
  return useQuery({
    queryKey: queryKeys.channels(communityId),
    queryFn: ({ signal }) => endpoints.channels(api, communityId!, signal),
    enabled: ready && Boolean(communityId),
  });
}
export function useMessages(channelId?: string) {
  const { api, ready } = useAppData();
  return useInfiniteQuery({
    queryKey: queryKeys.messages(channelId),
    queryFn: ({ pageParam, signal }) =>
      endpoints.messages(api, channelId!, pageParam, signal),
    initialPageParam: null as MessageCursor | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: ready && Boolean(channelId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    // Match member refresh cadence until a live-message transport is available.
    // React Query pauses background polling while the window is hidden.
    refetchInterval: 30_000,
  });
}
export function useCreateCommunity() {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      if (!ready) throw new ApiError("unauthorized");
      return endpoints.createCommunity(api, name);
    },
    onSuccess: () =>
      queries.invalidateQueries({ queryKey: queryKeys.communities }),
  });
}
export function useCreateChannel(communityId?: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      if (!ready || !communityId) throw new ApiError("unauthorized");
      return endpoints.createChannel(api, communityId, name);
    },
    onSuccess: () =>
      queries.invalidateQueries({ queryKey: queryKeys.channels(communityId) }),
  });
}
export function useAddMember(communityId: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => {
      if (!ready) throw new ApiError("unauthorized");
      return endpoints.addMember(api, communityId, userId);
    },
    onSuccess: () => Promise.all([
      queries.invalidateQueries({ queryKey: queryKeys.channelAccess(communityId) }),
      queries.invalidateQueries({ queryKey: queryKeys.members(communityId) }),
    ]),
  });
}
export function useChannelAccess(communityId: string, channelId: string, filters: ChannelAccessFilters, settled = true) {
  const { api, ready } = useAppData();
  return useInfiniteQuery({
    queryKey: [...queryKeys.channelAccess(communityId), channelId, filters],
    queryFn: ({ pageParam, signal }) => endpoints.channelAccess(api, communityId, channelId, filters, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: ready && settled,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    // Active dialogs recheck external membership/permission changes without a
    // permission-event or WebSocket API. Polling stops when the dialog closes.
    refetchInterval: 30_000,
  });
}
export function useMembers(communityId: string, channelId: string | undefined, search: string, settled = true) {
  const { api, ready } = useAppData();
  return useInfiniteQuery({
    queryKey: [...queryKeys.members(communityId), channelId ?? null, search],
    queryFn: ({ pageParam, signal }) => endpoints.members(api, communityId, channelId, search, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: ready && settled,
    staleTime: 10_000, refetchOnWindowFocus: true, refetchInterval: 30_000,
  });
}
export interface LocalMessage {
  message: Message;
  status: "pending" | "failed";
  error?: string;
  retryable?: boolean;
}

export function useSendMessage(channelId: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  const profile = useCurrentUser();
  const key = ["message-outbox", channelId] as const;
  const outbox = useQuery<LocalMessage[]>({
    queryKey: key, queryFn: () => [], initialData: [], enabled: false,
    // Pending and failed sends survive navigation, but SessionScope clears them on logout.
    gcTime: Infinity,
  });
  function update(nonce: string, change: (entry: LocalMessage) => LocalMessage | null) {
    queries.setQueryData<LocalMessage[]>(key, (previous) => previous?.flatMap((entry) => {
      if (entry.message.client_nonce !== nonce) return [entry];
      const next = change(entry);
      return next ? [next] : [];
    }));
  }
  const mutation = useMutation({
    mutationFn: async (input: { body: string; client_nonce: string }) => {
      if (!ready) throw new ApiError("unauthorized");
      const message = await endpoints.sendMessage(api, channelId, input);
      if (message.client_nonce !== input.client_nonce || message.author_id !== profile.data?.id) throw new ApiError("invalid_response");
      return message;
    },
    onSuccess: async (message, input) => {
      // A manual refresh started during the send must not overwrite confirmation.
      await queries.cancelQueries({ queryKey: queryKeys.messages(channelId) });
      if (!queries.getQueryData<LocalMessage[]>(key)?.some((entry) => entry.message.client_nonce === input.client_nonce)) return;
      queries.setQueryData(
        queryKeys.messages(channelId),
        (previous: Parameters<typeof mergeConfirmedMessage>[0]) =>
          mergeConfirmedMessage(previous, message),
      );
      update(input.client_nonce, () => null);
    },
    onError: (error, input) => {
      update(input.client_nonce, (entry) => ({ ...entry, status: "failed", error: apiErrorMessage(error),
        retryable: !(error instanceof ApiError && ["unauthorized", "session_transport", "auth_unavailable", "forbidden", "validation", "not_found", "conflict", "configuration"].includes(error.kind)),
      }));
    },
  });
  return {
    entries: outbox.data,
    send: (body: string) => {
      if (!ready || !profile.isSuccess) throw new ApiError("unauthorized");
      const nonce = crypto.randomUUID();
      const message: Message = { id: nonce, client_nonce: nonce, author_id: profile.data.id,
        author: profile.data, body, created_at: new Date().toISOString(), edited_at: null, deleted_at: null };
      queries.setQueryData<LocalMessage[]>(key, (previous = []) => [...previous, { message, status: "pending" }]);
      mutation.mutate({ body, client_nonce: nonce });
    },
    retry: (nonce: string) => {
      const entry = queries.getQueryData<LocalMessage[]>(key)?.find((entry) => entry.message.client_nonce === nonce);
      if (!ready || entry?.status !== "failed" || !entry.retryable) return;
      update(nonce, (entry) => ({ ...entry, status: "pending", error: undefined }));
      mutation.mutate({ body: entry.message.body!, client_nonce: nonce });
    },
  };
}
