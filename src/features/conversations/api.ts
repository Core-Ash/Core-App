import { mentionPayload, type Mention } from "@/features/mentions/model";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { useCurrentUser, type SendMessageOptions } from "@/features/community/api/hooks";
import { mergeConfirmedMessage } from "@/features/community/api/message-cache";
import { endpoints } from "@/lib/api/endpoints";
import { ApiError, apiErrorMessage } from "@/lib/api/errors";
import type { ConversationSummary, Message, MessageAttachment, MessageCursor } from "@/lib/api/types";

export const conversationQueryKeys = {
  conversations: ["conversations"] as const,
  conversation: (id?: string) => ["conversations", id] as const,
  members: (id?: string) => ["conversation-members", id] as const,
  messages: (id?: string) => ["conversation-messages", id] as const,
  notices: (id?: string) => ["conversation-bot-notices", id] as const,
};

export interface LocalConversationMessage {
  message: Message;
  status: "pending" | "failed";
  error?: string;
  retryable?: boolean;
}

export function useConversations() {
  const { api, ready } = useAppData();
  const profile = useCurrentUser();
  return useQuery({
    queryKey: conversationQueryKeys.conversations,
    queryFn: ({ signal }) => endpoints.conversations(api, signal),
    enabled: ready && profile.isSuccess,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
}

export function useConversation(conversationId?: string) {
  const { api, ready } = useAppData();
  return useQuery({
    queryKey: conversationQueryKeys.conversation(conversationId),
    queryFn: ({ signal }) => endpoints.conversation(api, conversationId!, signal),
    enabled: ready && Boolean(conversationId),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

export function useConversationMembers(conversationId?: string) {
  const { api, ready } = useAppData();
  return useQuery({
    queryKey: conversationQueryKeys.members(conversationId),
    queryFn: ({ signal }) => endpoints.conversationMembers(api, conversationId!, signal),
    enabled: ready && Boolean(conversationId),
    staleTime: 10_000,
  });
}

export function useConversationMessages(conversationId?: string) {
  const { api, ready } = useAppData();
  return useInfiniteQuery({
    queryKey: conversationQueryKeys.messages(conversationId),
    queryFn: ({ pageParam, signal }) =>
      endpoints.conversationMessages(api, conversationId!, pageParam, signal),
    initialPageParam: null as MessageCursor | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: ready && Boolean(conversationId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
}

export function useSendConversationMessage(conversationId: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  const profile = useCurrentUser();
  const key = ["conversation-message-outbox", conversationId] as const;
  const outbox = useQuery<LocalConversationMessage[]>({
    queryKey: key,
    queryFn: () => [],
    initialData: [],
    enabled: false,
    gcTime: Infinity,
  });

  function update(
    nonce: string,
    change: (entry: LocalConversationMessage) => LocalConversationMessage | null,
  ) {
    queries.setQueryData<LocalConversationMessage[]>(key, (previous) =>
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
      const message = await endpoints.sendConversationMessage(api, conversationId, input);
      if (
        message.client_nonce !== input.client_nonce ||
        message.author_id !== profile.data?.id
      )
        throw new ApiError("invalid_response");
      return message;
    },
    onSuccess: async (message, input) => {
      await queries.cancelQueries({
        queryKey: conversationQueryKeys.messages(conversationId),
      });
      if (
        !queries
          .getQueryData<LocalConversationMessage[]>(key)
          ?.some((entry) => entry.message.client_nonce === input.client_nonce)
      )
        return;
      queries.setQueryData(
        conversationQueryKeys.messages(conversationId),
        (previous: Parameters<typeof mergeConfirmedMessage>[0]) =>
          mergeConfirmedMessage(previous, message),
      );
      update(input.client_nonce, () => null);
      // Invalidate conversation list so last message updates
      void queries.invalidateQueries({
        queryKey: conversationQueryKeys.conversations,
      });
    },
    onError: (error, input) => {
      if (
        error instanceof ApiError &&
        (error.code === "DIRECT_MESSAGE_NOT_DELIVERED" ||
          (error.status === 403 &&
            error.message.includes("could not be delivered")))
      ) {
        // Remove pending message from outbox and spawn sender-only Core Bot notice
        update(input.client_nonce, () => null);
        const noticeKey = conversationQueryKeys.notices(conversationId);
        queries.setQueryData<{ id: string; createdAt: string }[]>(
          noticeKey,
          (previous = []) => {
            const now = new Date().toISOString();
            return [...previous, { id: input.client_nonce, createdAt: now }];
          },
        );
        return;
      }

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
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        ...(replyTo
          ? { reply_to_message_id: replyTo.id, reply_mention: replyMention, reply_to: replyTo }
          : {}),
        ...(attachments.length ? { attachments } : {}),
      };
      queries.setQueryData<LocalConversationMessage[]>(key, (previous = []) => [
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
        .getQueryData<LocalConversationMessage[]>(key)
        ?.find((entry) => entry.message.client_nonce === nonce);
      if (!ready || entry?.status !== "failed" || !entry.retryable) return;
      update(nonce, (entry) => ({
        ...entry,
        status: "pending",
        error: undefined,
      }));
      mutation.mutate({
        body: entry.message.body!,
        client_nonce: nonce,
        ...(entry.message.mentions?.length ? { mentions: mentionPayload(entry.message.mentions) } : {}),
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

export function useConversationNotices(conversationId?: string) {
  const queries = useQueryClient();
  const key = conversationQueryKeys.notices(conversationId);
  const notices = useQuery({
    queryKey: key,
    queryFn: () => queries.getQueryData<{ id: string; createdAt: string }[]>(key) ?? [],
    initialData: [],
    enabled: Boolean(conversationId),
    gcTime: Infinity,
  });

  return {
    notices: notices.data,
    dismiss: (id: string) => {
      queries.setQueryData<{ id: string; createdAt: string }[]>(
        key,
        (previous = []) => previous.filter((notice) => notice.id !== id),
      );
    },
  };
}

export function useCreateDirectConversation() {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (input: { recipient_id?: string; username?: string }) => {
      if (!ready) throw new ApiError("unauthorized");
      const existing = queries.getQueryData<ConversationSummary[]>(conversationQueryKeys.conversations)
        ?.find((conversation) => conversation.type === "direct" && !conversation.hidden &&
          conversation.members.some((member) => input.recipient_id
            ? member.id === input.recipient_id
            : `${member.profile.username}#${member.profile.discriminator}`.toLowerCase() === input.username?.trim().toLowerCase()));
      if (existing) return existing;
      // QueryClient shares the same in-flight promise across every entry point.
      return queries.fetchQuery({
        queryKey: ["resolve-direct", input.recipient_id ?? input.username?.trim().toLowerCase()],
        queryFn: async () => {
          try {
            return await endpoints.createDirectConversation(api, input);
          } catch (error) {
            if (import.meta.env.DEV) console.debug("Direct conversation resolution failed", {
              kind: error instanceof ApiError ? error.kind : "unknown",
              status: error instanceof ApiError ? error.status : undefined,
            });
            throw error;
          }
        },
        staleTime: 0,
        gcTime: 0,
        retry: false,
      });
    },
    onSuccess: (conversation) => {
      const cached = queries.getQueryData<ConversationSummary[]>(conversationQueryKeys.conversations);
      if (cached?.some((item) => item.id === conversation.id && !item.hidden)) return;
      // Summary responses can include a preview; preserve it when reopening.
      queries.setQueryData<ConversationSummary[]>(conversationQueryKeys.conversations, (previous = []) => [
        { ...conversation, hidden: false, last_message: previous.find((item) => item.id === conversation.id)?.last_message ?? null },
        ...previous.filter((item) => item.id !== conversation.id),
      ]);
      void queries.invalidateQueries({ queryKey: conversationQueryKeys.conversations, exact: true });
    },
  });
}

export function useCreateGroupConversation() {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (input: { recipient_ids: string[]; name?: string }) => {
      if (!ready) throw new ApiError("unauthorized");
      return endpoints.createGroupConversation(api, input);
    },
    onSuccess: (conversation) => {
      queries.setQueryData(conversationQueryKeys.conversation(conversation.id), conversation);
      queries.setQueryData<ConversationSummary[]>(conversationQueryKeys.conversations, (previous = []) => [
        { ...conversation, hidden: false, last_message: null },
        ...previous.filter((item) => item.id !== conversation.id),
      ]);
      void queries.invalidateQueries({ queryKey: conversationQueryKeys.conversations, exact: true });
    },
  });
}

export function useUpdateConversation(conversationId: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string }) => {
      if (!ready) throw new ApiError("unauthorized");
      return endpoints.updateConversation(api, conversationId, input);
    },
    onSuccess: (data) => {
      queries.setQueryData(
        conversationQueryKeys.conversation(conversationId),
        data,
      );
      void queries.invalidateQueries({
        queryKey: conversationQueryKeys.conversations,
      });
    },
  });
}

export function useHideConversation() {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!ready) throw new ApiError("unauthorized");
      return endpoints.hideConversation(api, id);
    },
    onSuccess: () =>
      queries.invalidateQueries({
        queryKey: conversationQueryKeys.conversations,
      }),
  });
}

export function useLeaveConversation() {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!ready) throw new ApiError("unauthorized");
      return endpoints.leaveConversation(api, id);
    },
    onSuccess: () =>
      queries.invalidateQueries({
        queryKey: conversationQueryKeys.conversations,
      }),
  });
}

export function useAddConversationMembers(conversationId: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => {
      if (!ready) throw new ApiError("unauthorized");
      return endpoints.addConversationMembers(api, conversationId, userIds);
    },
    onSuccess: () => {
      void queries.invalidateQueries({
        queryKey: conversationQueryKeys.conversation(conversationId),
      });
      void queries.invalidateQueries({
        queryKey: conversationQueryKeys.members(conversationId),
      });
      void queries.invalidateQueries({
        queryKey: conversationQueryKeys.conversations,
      });
    },
  });
}

export function useRemoveConversationMember(conversationId: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => {
      if (!ready) throw new ApiError("unauthorized");
      return endpoints.removeConversationMember(api, conversationId, userId);
    },
    onSuccess: () => {
      void queries.invalidateQueries({
        queryKey: conversationQueryKeys.conversation(conversationId),
      });
      void queries.invalidateQueries({
        queryKey: conversationQueryKeys.members(conversationId),
      });
      void queries.invalidateQueries({
        queryKey: conversationQueryKeys.conversations,
      });
    },
  });
}
