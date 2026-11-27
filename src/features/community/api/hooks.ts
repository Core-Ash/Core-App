import { mentionPayload, type Mention } from "@/features/mentions/model";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { ApiError, apiErrorMessage } from "@/lib/api/errors";
import { endpoints } from "@/lib/api/endpoints";
import { mergeConfirmedMessage, updateCachedMessage } from "@/features/community/api/message-cache";
import type {
  ChannelAccessFilters,
  MessageAttachment,
  MessageCursor,
  Message,
  MessageReplyReference,
} from "@/lib/api/types";

export const queryKeys = {
  profile: ["profile"] as const,
  communities: ["communities"] as const,
  channels: (communityId: string | undefined) =>
    ["channels", communityId] as const,
  messages: (channelId: string | undefined) => ["messages", channelId] as const,
  channelAccess: (communityId: string) => ["channel-access", communityId] as const,
  members: (communityId: string) => ["members", communityId] as const,
  channelThreads: (channelId: string | undefined) => ["channel-threads", channelId] as const,
  thread: (threadId: string | undefined) => ["thread", threadId] as const,
  threadMessages: (threadId: string | undefined) => ["thread-messages", threadId] as const,
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
    refetchInterval: 15000,
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
    mutationFn: (
      input: string | { name: string; category_id?: string | null; kind?: "text" | "voice" },
    ) => {
      if (!ready || !communityId) throw new ApiError("unauthorized");
      return endpoints.createChannel(api, communityId, input);
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

export interface SendMessageOptions {
  replyTo?: MessageReplyReference | null;
  replyMention?: boolean;
  attachments?: MessageAttachment[];
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
    mutationFn: async (input: {
      body: string;
      client_nonce: string;
      mentions?: Mention[];
      reply_to_message_id?: string | null;
      reply_mention?: boolean;
      attachments?: MessageAttachment[];
    }) => {
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
    send: (body: string, mentions: Mention[] = [], options?: SendMessageOptions) => {
      if (!ready || !profile.isSuccess) throw new ApiError("unauthorized");
      const nonce = crypto.randomUUID();
      const replyTo = options?.replyTo ?? null;
      const replyMention = options?.replyMention ?? false;
      const attachments = options?.attachments ?? [];
      const message: Message = {
        id: nonce,
        client_nonce: nonce,
        author_id: profile.data.id,
        author: profile.data,
        body,
        mentions,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        ...(replyTo ? { reply_to_message_id: replyTo.id, reply_mention: replyMention, reply_to: replyTo } : {}),
        ...(attachments.length ? { attachments } : {}),
      };
      queries.setQueryData<LocalMessage[]>(key, (previous = []) => [...previous, { message, status: "pending" }]);
      mutation.mutate({
        body,
        client_nonce: nonce,
        ...(mentions.length ? { mentions: mentionPayload(mentions) } : {}),
        ...(replyTo ? { reply_to_message_id: replyTo.id, reply_mention: replyMention } : {}),
        ...(attachments.length ? { attachments } : {}),
      });
    },
    retry: (nonce: string) => {
      const entry = queries.getQueryData<LocalMessage[]>(key)?.find((entry) => entry.message.client_nonce === nonce);
      if (!ready || entry?.status !== "failed" || !entry.retryable) return;
      update(nonce, (entry) => ({ ...entry, status: "pending", error: undefined }));
      mutation.mutate({
        body: entry.message.body!,
        client_nonce: nonce,
        ...(entry.message.mentions?.length ? { mentions: mentionPayload(entry.message.mentions) } : {}),
        ...(entry.message.reply_to_message_id ? { reply_to_message_id: entry.message.reply_to_message_id, reply_mention: entry.message.reply_mention } : {}),
        ...(entry.message.attachments?.length ? { attachments: entry.message.attachments } : {}),
      });
    },
  };
}

export function useToggleReaction(
  scopeKind: "channel" | "conversation",
  scopeId: string,
  cacheKey: readonly unknown[],
) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  const profile = useCurrentUser();

  return useMutation({
    mutationFn: async (input: {
      messageId: string;
      emoji: string;
      emojiName?: string | null;
      emojiUrl?: string | null;
      remove: boolean;
    }) => {
      if (!ready) throw new ApiError("unauthorized");
      if (input.remove) {
        return endpoints.removeReaction(api, scopeKind, scopeId, input.messageId, input.emoji);
      }
      return endpoints.addReaction(api, scopeKind, scopeId, input.messageId, {
        emoji: input.emoji,
        emoji_name: input.emojiName,
        emoji_url: input.emojiUrl,
      });
    },
    onMutate: async (input) => {
      await queries.cancelQueries({ queryKey: cacheKey });
      const previous = queries.getQueryData<Parameters<typeof updateCachedMessage>[0]>(cacheKey);
      const currentUser = profile.data;
      if (currentUser) {
        queries.setQueryData(
          cacheKey,
          (old: Parameters<typeof updateCachedMessage>[0]) =>
            updateCachedMessage(old, input.messageId, (msg) => {
              const current = msg.reactions ?? [];
              const existingIdx = current.findIndex((r) => r.emoji === input.emoji);
              const nextReactions = [...current];
              if (input.remove) {
                if (existingIdx >= 0) {
                  const group = nextReactions[existingIdx]!;
                  const nextCount = Math.max(0, group.count - 1);
                  if (nextCount === 0) {
                    nextReactions.splice(existingIdx, 1);
                  } else {
                    nextReactions[existingIdx] = {
                      ...group,
                      count: nextCount,
                      me: false,
                      users: group.users.filter((u) => u.id !== currentUser.id),
                    };
                  }
                }
              } else if (existingIdx >= 0) {
                const group = nextReactions[existingIdx]!;
                if (!group.me) {
                  nextReactions[existingIdx] = {
                    ...group,
                    count: group.count + 1,
                    me: true,
                    users: [...group.users, currentUser],
                  };
                }
              } else {
                nextReactions.push({
                  emoji: input.emoji,
                  emoji_name: input.emojiName ?? null,
                  emoji_url: input.emojiUrl ?? null,
                  count: 1,
                  me: true,
                  users: [currentUser],
                });
              }
              return { ...msg, reactions: nextReactions };
            }),
        );
      }
      return { previous };
    },
    onSuccess: (updatedMessage) => {
      queries.setQueryData(
        cacheKey,
        (old: Parameters<typeof updateCachedMessage>[0]) =>
          updateCachedMessage(old, updatedMessage.id, () => updatedMessage),
      );
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queries.setQueryData(cacheKey, context.previous);
      }
    },
  });
}

export function useChannelThreads(channelId?: string) {
  const { api, ready } = useAppData();
  return useQuery({
    queryKey: queryKeys.channelThreads(channelId),
    queryFn: ({ signal }) => endpoints.channelThreads(api, channelId!, signal),
    enabled: ready && Boolean(channelId),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

export function useThread(threadId?: string) {
  const { api, ready } = useAppData();
  return useQuery({
    queryKey: queryKeys.thread(threadId),
    queryFn: ({ signal }) => endpoints.thread(api, threadId!, signal),
    enabled: ready && Boolean(threadId),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  });
}

export function useThreadMessages(threadId?: string) {
  const { api, ready } = useAppData();
  return useInfiniteQuery({
    queryKey: queryKeys.threadMessages(threadId),
    queryFn: ({ pageParam, signal }) =>
      endpoints.threadMessages(api, threadId!, pageParam, signal),
    initialPageParam: null as MessageCursor | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: ready && Boolean(threadId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  });
}

export function useSendThreadMessage(threadId: string, parentChannelId?: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  const profile = useCurrentUser();
  const key = ["thread-message-outbox", threadId] as const;
  const outbox = useQuery<LocalMessage[]>({
    queryKey: key,
    queryFn: () => [],
    initialData: [],
    enabled: false,
    gcTime: Infinity,
  });

  function update(nonce: string, change: (entry: LocalMessage) => LocalMessage | null) {
    queries.setQueryData<LocalMessage[]>(key, (previous) =>
      previous?.flatMap((entry) => {
        if (entry.message.client_nonce !== nonce) return [entry];
        const next = change(entry);
        return next ? [next] : [];
      }),
    );
  }

  const mutation = useMutation({
    mutationFn: async (input: {
      body: string;
      client_nonce: string;
      mentions?: Mention[];
      reply_to_message_id?: string | null;
      reply_mention?: boolean;
      attachments?: MessageAttachment[];
    }) => {
      if (!ready) throw new ApiError("unauthorized");
      const message = await endpoints.sendThreadMessage(api, threadId, input);
      if (message.client_nonce !== input.client_nonce || message.author_id !== profile.data?.id)
        throw new ApiError("invalid_response");
      return message;
    },
    onSuccess: async (message, input) => {
      await queries.cancelQueries({ queryKey: queryKeys.threadMessages(threadId) });
      if (
        !queries
          .getQueryData<LocalMessage[]>(key)
          ?.some((entry) => entry.message.client_nonce === input.client_nonce)
      )
        return;
      queries.setQueryData(
        queryKeys.threadMessages(threadId),
        (previous: Parameters<typeof mergeConfirmedMessage>[0]) =>
          mergeConfirmedMessage(previous, message),
      );
      update(input.client_nonce, () => null);
      void queries.invalidateQueries({ queryKey: queryKeys.thread(threadId) });
      if (parentChannelId) {
        void queries.invalidateQueries({ queryKey: queryKeys.messages(parentChannelId) });
        void queries.invalidateQueries({ queryKey: queryKeys.channelThreads(parentChannelId) });
      }
    },
    onError: (error, input) => {
      update(input.client_nonce, (entry) => ({
        ...entry,
        status: "failed",
        error: apiErrorMessage(error),
        retryable: !(
          error instanceof ApiError &&
          [
            "unauthorized",
            "session_transport",
            "auth_unavailable",
            "forbidden",
            "validation",
            "not_found",
            "conflict",
            "configuration",
          ].includes(error.kind)
        ),
      }));
    },
  });

  return {
    entries: outbox.data,
    send: (body: string, mentions: Mention[] = [], options?: SendMessageOptions) => {
      if (!ready || !profile.isSuccess) throw new ApiError("unauthorized");
      const nonce = crypto.randomUUID();
      const replyTo = options?.replyTo ?? null;
      const replyMention = options?.replyMention ?? false;
      const attachments = options?.attachments ?? [];
      const message: Message = {
        id: nonce,
        client_nonce: nonce,
        author_id: profile.data.id,
        author: profile.data,
        body,
        mentions,
        thread_id: threadId,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        ...(replyTo
          ? { reply_to_message_id: replyTo.id, reply_mention: replyMention, reply_to: replyTo }
          : {}),
        ...(attachments.length ? { attachments } : {}),
      };
      queries.setQueryData<LocalMessage[]>(key, (previous = []) => [
        ...previous,
        { message, status: "pending" },
      ]);
      mutation.mutate({
        body,
        client_nonce: nonce,
        ...(mentions.length ? { mentions: mentionPayload(mentions) } : {}),
        ...(replyTo ? { reply_to_message_id: replyTo.id, reply_mention: replyMention } : {}),
        ...(attachments.length ? { attachments } : {}),
      });
    },
    retry: (nonce: string) => {
      const entry = queries
        .getQueryData<LocalMessage[]>(key)
        ?.find((entry) => entry.message.client_nonce === nonce);
      if (!ready || entry?.status !== "failed" || !entry.retryable) return;
      update(nonce, (entry) => ({ ...entry, status: "pending", error: undefined }));
      mutation.mutate({
        body: entry.message.body!,
        client_nonce: nonce,
        ...(entry.message.mentions?.length
          ? { mentions: mentionPayload(entry.message.mentions) }
          : {}),
        ...(entry.message.reply_to_message_id
          ? {
              reply_to_message_id: entry.message.reply_to_message_id,
              reply_mention: entry.message.reply_mention,
            }
          : {}),
        ...(entry.message.attachments?.length ? { attachments: entry.message.attachments } : {}),
      });
    },
  };
}
