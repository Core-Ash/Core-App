import type { ApiClient } from "@/lib/api/client";
import {
  parseBootstrap,
  parseChannel,
  parseCommunity,
  parseList,
  parseMessage,
  parseMessagePage,
  parseProfile,
} from "@/lib/api/contracts";
import type { MessageCursor } from "@/lib/api/types";

export const endpoints = {
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
};
