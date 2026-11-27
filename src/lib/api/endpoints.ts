import { mentionPayload, type Mention } from "@/features/mentions/model";
import type { ApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import {
  parseBootstrap,
  parseChannel,
  parseChannelCategory,
  parseCommunity,
  parseList,
  parseMessage,
  parseMessagePage,
  parseProfile,
  parseChannelAccess,
  parseMemberPage,
  parseConversationSummary,
  parseConversationDetail,
  parseConversationParticipant,
  parseReactionUsersPage,
  parseThreadDetail,
  record,
} from "@/lib/api/contracts";
import type { ChannelAccessFilters, MessageAttachment, MessageCursor } from "@/lib/api/types";

function attachmentPayload(items: MessageAttachment[]) {
  return items.map((a) => ({
    id: a.id,
    name: a.name,
    content_type: a.content_type,
    size_bytes: a.size_bytes,
    url: a.url,
  }));
}

export const endpoints = {
  members: async (api: ApiClient, communityId: string, channelId: string | undefined, search: string, afterId: string | null, signal?: AbortSignal) => {
    const scope = channelId ? `/channels/${channelId}` : "";
    const result = parseMemberPage(await api.get(`/communities/${communityId}${scope}/members`, {
      signal, query: { search, limit: 50, after_id: afterId ?? undefined },
    }));
    if (result.community_id !== communityId || result.channel_id !== (channelId ?? null) || result.items.some((member) => member.community_id !== communityId))
      throw new ApiError("invalid_response");
    return result;
  },
  channelAccess: async (
    api: ApiClient, communityId: string, channelId: string,
    filters: ChannelAccessFilters, afterId: string | null, signal?: AbortSignal,
  ) => {
    const result = parseChannelAccess(await api.get(`/communities/${communityId}/channels/${channelId}/access`, {
      signal, query: { limit: 50, after_id: afterId ?? undefined, search: filters.search,
        role_id: filters.roleId || undefined, access: filters.access },
    }));
    if (result.channel.id !== channelId || result.channel.community_id !== communityId)
      throw new ApiError("invalid_response");
    return result;
  },
  bootstrap: async (api: ApiClient, signal?: AbortSignal) =>
    parseBootstrap(await api.get("/bootstrap", { signal })),
  currentUser: async (api: ApiClient, signal?: AbortSignal) =>
    parseProfile(await api.get("/me", { signal })),
  createProfile: async (api: ApiClient) =>
    parseProfile(await api.post("/me", {})),
  communities: async (api: ApiClient, signal?: AbortSignal) =>
    parseList(await api.get("/communities", { signal }), parseCommunity),
  createCommunity: async (api: ApiClient, name: string) =>
    parseCommunity(await api.post("/communities", { name })),
  addMember: async (api: ApiClient, communityId: string, userId: string) => {
    // The Rust route returns 201 without a response body.
    await api.post<void>(`/communities/${communityId}/members`, { user_id: userId });
  },
  channels: async (api: ApiClient, communityId: string, signal?: AbortSignal) =>
    parseList(
      await api.get(`/communities/${communityId}/channels`, { signal }),
      parseChannel,
    ),
  createChannel: async (
    api: ApiClient,
    communityId: string,
    input: string | { name: string; category_id?: string | null; kind?: "text" | "voice" },
  ) => {
    const body = typeof input === "string" ? { name: input } : (
      input.category_id !== undefined || input.kind !== undefined
        ? input
        : { name: input.name }
    );
    return parseChannel(
      await api.post(`/communities/${communityId}/channels`, body),
    );
  },
  categories: async (api: ApiClient, communityId: string, signal?: AbortSignal) => {
    const res = await api.get<{ items: unknown[]; hide_muted_channels: boolean }>(
      `/communities/${communityId}/categories`,
      { signal },
    );
    return {
      items: (res.items || []).map(parseChannelCategory),
      hide_muted_channels: Boolean(res.hide_muted_channels),
    };
  },
  createCategory: async (
    api: ApiClient,
    communityId: string,
    payload: { name: string; is_private?: boolean; roles?: string[] },
  ) =>
    parseChannelCategory(
      await api.post(`/communities/${communityId}/categories`, payload),
    ),
  updateCategory: async (
    api: ApiClient,
    communityId: string,
    categoryId: string,
    payload: { name?: string; is_private?: boolean; position?: number; roles?: string[] },
  ) =>
    parseChannelCategory(
      await api.patch(`/communities/${communityId}/categories/${categoryId}`, payload),
    ),
  deleteCategory: async (api: ApiClient, communityId: string, categoryId: string) => {
    await api.delete(`/communities/${communityId}/categories/${categoryId}`);
  },
  reorderCategories: async (api: ApiClient, communityId: string, order: string[]) => {
    await api.post(`/communities/${communityId}/categories/reorder`, { order });
  },
  reorderChannels: async (
    api: ApiClient,
    communityId: string,
    items: { id: string; category_id: string | null; position: number }[],
  ) => {
    await api.post(`/communities/${communityId}/channels/reorder`, { items });
  },
  updateChannel: async (
    api: ApiClient,
    communityId: string,
    channelId: string,
    payload: { name?: string; topic?: string; category_id?: string | null; position?: number },
  ) =>
    parseChannel(
      await api.patch(`/communities/${communityId}/channels/${channelId}`, payload),
    ),
  setCommunityPreferences: async (
    api: ApiClient,
    communityId: string,
    payload: { hide_muted_channels: boolean },
  ) => {
    return await api.put<{ hide_muted_channels: boolean }>(
      `/communities/${communityId}/preferences`,
      payload,
    );
  },
  setChannelMute: async (api: ApiClient, channelId: string, is_muted: boolean) => {
    return await api.put<{ is_muted: boolean }>(`/channels/${channelId}/mute`, { is_muted });
  },
  setCategoryMute: async (api: ApiClient, categoryId: string, is_muted: boolean) => {
    return await api.put<{ is_muted: boolean }>(`/categories/${categoryId}/mute`, { is_muted });
  },
  setCategoryCollapse: async (api: ApiClient, categoryId: string, is_collapsed: boolean) => {
    return await api.put<{ is_collapsed: boolean }>(`/categories/${categoryId}/collapse`, { is_collapsed });
  },
  messages: async (
    api: ApiClient,
    channelId: string,
    cursor: MessageCursor | null,
    signal?: AbortSignal,
  ) =>
    parseMessagePage(
      await api.get(`/channels/${channelId}/messages`, {
        signal,
        query: {
          limit: 50,
          before_time: cursor?.before_time,
          before_id: cursor?.before_id,
        },
      }),
    ),
  sendMessage: async (
    api: ApiClient,
    channelId: string,
    input: {
      body: string;
      client_nonce: string;
      mentions?: Mention[];
      reply_to_message_id?: string | null;
      reply_mention?: boolean;
      attachments?: MessageAttachment[];
    },
  ) =>
    parseMessage(
      await api.post(`/channels/${channelId}/messages`, {
        body: input.body,
        client_nonce: input.client_nonce,
        ...(input.mentions ? { mentions: mentionPayload(input.mentions) } : {}),
        ...(input.reply_to_message_id ? { reply_to_message_id: input.reply_to_message_id } : {}),
        ...(input.reply_mention !== undefined ? { reply_mention: input.reply_mention } : {}),
        ...(input.attachments?.length ? { attachments: attachmentPayload(input.attachments) } : {}),
      }),
    ),
  getMessageAround: async (
    api: ApiClient,
    scopeKind: "channel" | "conversation",
    scopeId: string,
    messageId: string,
    signal?: AbortSignal,
  ) => {
    const prefix = scopeKind === "channel" ? "channels" : "conversations";
    const res = record(await api.get(`/${prefix}/${scopeId}/messages/${messageId}`, { signal }));
    return {
      message: parseMessage(res.message),
      items: Array.isArray(res.items) ? res.items.map(parseMessage) : [],
    };
  },
  addReaction: async (
    api: ApiClient,
    scopeKind: "channel" | "conversation",
    scopeId: string,
    messageId: string,
    input: { emoji: string; emoji_name?: string | null; emoji_url?: string | null },
  ) => {
    const prefix = scopeKind === "channel" ? "channels" : "conversations";
    return parseMessage(
      await api.post(`/${prefix}/${scopeId}/messages/${messageId}/reactions`, {
        emoji: input.emoji,
        ...(input.emoji_name ? { emoji_name: input.emoji_name } : {}),
        ...(input.emoji_url ? { emoji_url: input.emoji_url } : {}),
      }),
    );
  },
  removeReaction: async (
    api: ApiClient,
    scopeKind: "channel" | "conversation",
    scopeId: string,
    messageId: string,
    emoji: string,
  ) => {
    const prefix = scopeKind === "channel" ? "channels" : "conversations";
    return parseMessage(
      await api.delete(`/${prefix}/${scopeId}/messages/${messageId}/reactions`, {
        query: { emoji },
      }),
    );
  },
  reactionUsers: async (
    api: ApiClient,
    scopeKind: "channel" | "conversation",
    scopeId: string,
    messageId: string,
    query: { emoji?: string; limit?: number; after_id?: string | null },
    signal?: AbortSignal,
  ) => {
    const prefix = scopeKind === "channel" ? "channels" : "conversations";
    return parseReactionUsersPage(
      await api.get(`/${prefix}/${scopeId}/messages/${messageId}/reactions`, {
        signal,
        query: {
          emoji: query.emoji,
          limit: query.limit ?? 50,
          after_id: query.after_id ?? undefined,
        },
      }),
    );
  },
  forwardMessage: async (
    api: ApiClient,
    input: {
      source_kind: "channel" | "conversation" | "thread";
      source_id: string;
      message_id: string;
      destination_kind: "channel" | "conversation";
      destination_id: string;
      client_nonce: string;
      comment?: string;
    },
  ) => parseMessage(await api.post("/messages/forward", input)),
  channelThreads: async (api: ApiClient, channelId: string, signal?: AbortSignal) =>
    parseList(await api.get(`/channels/${channelId}/threads`, { signal }), parseThreadDetail),
  createThread: async (
    api: ApiClient,
    channelId: string,
    input: {
      name: string;
      starter_message_id: string;
      thread_type?: "public" | "private";
      initial_message?: string;
      client_nonce?: string;
      participant_ids?: string[];
    },
  ) => parseThreadDetail(await api.post(`/channels/${channelId}/threads`, input)),
  thread: async (api: ApiClient, threadId: string, signal?: AbortSignal) =>
    parseThreadDetail(await api.get(`/threads/${threadId}`, { signal })),
  updateThread: async (
    api: ApiClient,
    threadId: string,
    input: { name?: string; archived?: boolean; locked?: boolean },
  ) => parseThreadDetail(await api.patch(`/threads/${threadId}`, input)),
  deleteThread: async (api: ApiClient, threadId: string) => {
    await api.delete(`/threads/${threadId}`);
  },
  joinThread: async (api: ApiClient, threadId: string, userId?: string) =>
    parseThreadDetail(
      await api.post(`/threads/${threadId}/join`, userId ? { user_id: userId } : {}),
    ),
  leaveThread: async (api: ApiClient, threadId: string) =>
    parseThreadDetail(await api.post(`/threads/${threadId}/leave`, {})),
  threadMessages: async (
    api: ApiClient,
    threadId: string,
    cursor: MessageCursor | null,
    signal?: AbortSignal,
  ) =>
    parseMessagePage(
      await api.get(`/threads/${threadId}/messages`, {
        signal,
        query: {
          limit: 50,
          before_time: cursor?.before_time,
          before_id: cursor?.before_id,
        },
      }),
    ),
  sendThreadMessage: async (
    api: ApiClient,
    threadId: string,
    input: {
      body: string;
      client_nonce: string;
      mentions?: Mention[];
      reply_to_message_id?: string | null;
      reply_mention?: boolean;
      attachments?: MessageAttachment[];
    },
  ) =>
    parseMessage(
      await api.post(`/threads/${threadId}/messages`, {
        body: input.body,
        client_nonce: input.client_nonce,
        ...(input.mentions ? { mentions: mentionPayload(input.mentions) } : {}),
        ...(input.reply_to_message_id ? { reply_to_message_id: input.reply_to_message_id } : {}),
        ...(input.reply_mention !== undefined ? { reply_mention: input.reply_mention } : {}),
        ...(input.attachments?.length ? { attachments: attachmentPayload(input.attachments) } : {}),
      }),
    ),
  conversations: async (api: ApiClient, signal?: AbortSignal) =>
    parseList(await api.get("/conversations", { signal }), parseConversationSummary),
  conversation: async (api: ApiClient, id: string, signal?: AbortSignal) =>
    parseConversationDetail(await api.get(`/conversations/${id}`, { signal })),
  createDirectConversation: async (
    api: ApiClient,
    input: { recipient_id?: string; username?: string },
  ) => {
    const result = parseConversationDetail(await api.post("/conversations/direct", input), true);
    if (result.type !== "direct" || (input.recipient_id && !result.members.some((m) => m.id === input.recipient_id)))
      throw new ApiError("invalid_response");
    return result;
  },
  createGroupConversation: async (
    api: ApiClient,
    input: { recipient_ids: string[]; name?: string },
  ) => parseConversationDetail(await api.post("/conversations/group", input)),
  updateConversation: async (
    api: ApiClient,
    id: string,
    input: { name?: string },
  ) => parseConversationDetail(await api.patch(`/conversations/${id}`, input)),
  hideConversation: async (api: ApiClient, id: string) => {
    await api.post(`/conversations/${id}/hide`, {});
  },
  leaveConversation: async (api: ApiClient, id: string) => {
    await api.post(`/conversations/${id}/leave`, {});
  },
  conversationMembers: async (api: ApiClient, id: string, signal?: AbortSignal) =>
    parseList(await api.get(`/conversations/${id}/members`, { signal }), parseConversationParticipant),
  addConversationMembers: async (api: ApiClient, id: string, userIds: string[]) =>
    parseList(await api.post(`/conversations/${id}/members`, { user_ids: userIds }), parseConversationParticipant),
  removeConversationMember: async (api: ApiClient, id: string, userId: string) => {
    await api.delete(`/conversations/${id}/members/${userId}`);
  },
  conversationMessages: async (
    api: ApiClient,
    id: string,
    cursor: MessageCursor | null,
    signal?: AbortSignal,
  ) =>
    parseMessagePage(
      await api.get(`/conversations/${id}/messages`, {
        signal,
        query: {
          limit: 50,
          before_time: cursor?.before_time,
          before_id: cursor?.before_id,
        },
      }),
    ),
  sendConversationMessage: async (
    api: ApiClient,
    id: string,
    input: {
      body: string;
      client_nonce: string;
      mentions?: Mention[];
      reply_to_message_id?: string | null;
      reply_mention?: boolean;
      attachments?: MessageAttachment[];
    },
  ) =>
    parseMessage(
      await api.post(`/conversations/${id}/messages`, {
        body: input.body,
        client_nonce: input.client_nonce,
        ...(input.mentions ? { mentions: mentionPayload(input.mentions) } : {}),
        ...(input.reply_to_message_id ? { reply_to_message_id: input.reply_to_message_id } : {}),
        ...(input.reply_mention !== undefined ? { reply_mention: input.reply_mention } : {}),
        ...(input.attachments?.length ? { attachments: attachmentPayload(input.attachments) } : {}),
      }),
    ),
};
