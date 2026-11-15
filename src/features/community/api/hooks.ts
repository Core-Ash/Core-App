import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { ApiError } from "@/lib/api/errors";
import { endpoints } from "@/lib/api/endpoints";
import { mergeConfirmedMessage } from "@/features/community/api/message-cache";
import type { MessageCursor } from "@/lib/api/types";

export const queryKeys = {
  profile: ["profile"] as const,
  communities: ["communities"] as const,
  channels: (communityId: string | undefined) =>
    ["channels", communityId] as const,
  messages: (channelId: string | undefined) => ["messages", channelId] as const,
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
export function useSendMessage(channelId: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; client_nonce: string }) => {
      if (!ready) throw new ApiError("unauthorized");
      return endpoints.sendMessage(api, channelId, input);
    },
    onMutate: () =>
      queries.cancelQueries({ queryKey: queryKeys.messages(channelId) }),
    onSuccess: async (message) => {
      // A manual refresh started during the send must not overwrite confirmation.
      await queries.cancelQueries({ queryKey: queryKeys.messages(channelId) });
      queries.setQueryData(
        queryKeys.messages(channelId),
        (previous: Parameters<typeof mergeConfirmedMessage>[0]) =>
          mergeConfirmedMessage(previous, message),
      );
    },
  });
}
