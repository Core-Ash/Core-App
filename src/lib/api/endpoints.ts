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
} from "@/lib/api/contracts";
import type { ChannelAccessFilters, MessageCursor } from "@/lib/api/types";

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
    input: { body: string; client_nonce: string; mentions?: Mention[] },
  ) => parseMessage(await api.post(`/channels/${channelId}/messages`, { ...input, ...(input.mentions ? { mentions: mentionPayload(input.mentions) } : {}) })),
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
    input: { body: string; client_nonce: string; mentions?: Mention[] },
  ) => parseMessage(await api.post(`/conversations/${id}/messages`, { ...input, ...(input.mentions ? { mentions: mentionPayload(input.mentions) } : {}) })),
};
