import type { ApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import {
  parseBootstrap,
  parseChannel,
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
  createChannel: async (api: ApiClient, communityId: string, name: string) =>
    parseChannel(
      await api.post(`/communities/${communityId}/channels`, { name }),
    ),
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
    input: { body: string; client_nonce: string },
  ) => parseMessage(await api.post(`/channels/${channelId}/messages`, input)),
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
    input: { body: string; client_nonce: string },
  ) => parseMessage(await api.post(`/conversations/${id}/messages`, input)),
};
