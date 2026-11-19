import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import type {
  AutoModRuleData,
  ServerAuditLogData,
  ServerBanData,
  ServerEmojiData,
  ServerOnboardingData,
  ServerRoleData,
  ServerSettingsData,
  ServerSettingsPermissions,
  ServerSoundData,
  ServerStickerData,
  ServerTemplateData,
  UpdateServerSettingsInput,
} from "./types";

export const serverSettingsKeys = {
  settings: (communityId: string) => ["server-settings", communityId] as const,
  permissions: (communityId: string) => ["server-permissions", communityId] as const,
  roles: (communityId: string) => ["server-roles", communityId] as const,
  bans: (communityId: string) => ["server-bans", communityId] as const,
  auditLogs: (communityId: string, filter?: string) =>
    ["server-audit-logs", communityId, filter] as const,
  automod: (communityId: string) => ["server-automod", communityId] as const,
  emojis: (communityId: string) => ["server-emojis", communityId] as const,
  stickers: (communityId: string) => ["server-stickers", communityId] as const,
  soundboard: (communityId: string) => ["server-soundboard", communityId] as const,
  onboarding: (communityId: string) => ["server-onboarding", communityId] as const,
  templates: (communityId: string) => ["server-templates", communityId] as const,
  tagPreference: (communityId: string) =>
    ["server-tag-preference", communityId] as const,
};

export function useServerPermissions(communityId?: string) {
  const { api, ready } = useAppData();
  return useQuery<ServerSettingsPermissions>({
    queryKey: communityId ? serverSettingsKeys.permissions(communityId) : ["server-permissions"],
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/permissions`, { signal }),
    enabled: ready && Boolean(communityId),
    staleTime: 30_000,
  });
}

export function useServerSettings(communityId: string) {
  const { api, ready } = useAppData();
  return useQuery<ServerSettingsData>({
    queryKey: serverSettingsKeys.settings(communityId),
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/settings`, { signal }),
    enabled: ready && Boolean(communityId),
  });
}

export function useUpdateServerSettings(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateServerSettingsInput) =>
      api.patch<ServerSettingsData>(
        `/communities/${communityId}/settings`,
        data as unknown as Parameters<typeof api.patch>[1],
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(serverSettingsKeys.settings(communityId), updated);
      void queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
  });
}

export function useDeleteServer(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirmName: string) =>
      api.delete<void>(
        `/communities/${communityId}`,
        { confirm_name: confirmName } as unknown as Parameters<typeof api.delete>[1],
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
  });
}

export function useServerRoles(communityId: string) {
  const { api, ready } = useAppData();
  return useQuery<{ items: ServerRoleData[] }>({
    queryKey: serverSettingsKeys.roles(communityId),
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/roles`, { signal }),
    enabled: ready && Boolean(communityId),
  });
}

export function useCreateServerRole(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      color?: string;
      position?: number;
      permissions?: string[];
      hoist?: boolean;
      mentionable?: boolean;
    }) => api.post(`/communities/${communityId}/roles`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.roles(communityId),
      });
    },
  });
}

export function useUpdateServerRole(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      ...data
    }: {
      roleId: string;
      name?: string;
      color?: string | null;
      position?: number;
      permissions?: string[];
      hoist?: boolean;
      mentionable?: boolean;
    }) => api.patch(`/communities/${communityId}/roles/${roleId}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.roles(communityId),
      });
    },
  });
}

export function useDeleteServerRole(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) =>
      api.delete<void>(`/communities/${communityId}/roles/${roleId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.roles(communityId),
      });
    },
  });
}

export function useReorderServerRoles(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (order: string[]) =>
      api.post(`/communities/${communityId}/roles/reorder`, { order }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.roles(communityId),
      });
    },
  });
}

export function useRoleMembers(communityId?: string, roleId?: string) {
  const { api, ready } = useAppData();
  return useQuery({
    queryKey: ["community", communityId, "roles", roleId, "members"],
    queryFn: async () => {
      const res = await api.get<{ items: import("./types").RoleMemberData[] }>(
        `/communities/${communityId}/roles/${roleId}/members`,
      );
      return res.items ?? [];
    },
    enabled: ready && Boolean(communityId && roleId),
  });
}

export function useAddRoleMember(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      api.post(`/communities/${communityId}/roles/${roleId}/members/${userId}`, {}),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["community", communityId, "roles", variables.roleId, "members"],
      });
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.roles(communityId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["members", communityId],
      });
    },
  });
}

export function useRemoveRoleMember(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      api.delete(`/communities/${communityId}/roles/${roleId}/members/${userId}`),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["community", communityId, "roles", variables.roleId, "members"],
      });
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.roles(communityId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["members", communityId],
      });
    },
  });
}

export function useUpdateMemberRoles(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      roleIds,
    }: {
      userId: string;
      roleIds: string[];
    }) =>
      api.patch<void>(`/communities/${communityId}/members/${userId}/roles`, {
        role_ids: roleIds,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", communityId] });
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.roles(communityId),
      });
    },
  });
}

export function useKickMember(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.post<void>(`/communities/${communityId}/members/${userId}/kick`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", communityId] });
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.settings(communityId),
      });
    },
  });
}

export function useBanMember(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      api.post<void>(`/communities/${communityId}/members/${userId}/ban`, {
        reason: reason || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", communityId] });
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.bans(communityId),
      });
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.settings(communityId),
      });
    },
  });
}

export function useServerBans(communityId: string) {
  const { api, ready } = useAppData();
  return useQuery<{ items: ServerBanData[] }>({
    queryKey: serverSettingsKeys.bans(communityId),
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/bans`, { signal }),
    enabled: ready && Boolean(communityId),
  });
}

export function useUnbanMember(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete<void>(`/communities/${communityId}/bans/${userId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.bans(communityId),
      });
    },
  });
}

export function useServerAuditLogs(communityId: string, actionFilter?: string) {
  const { api, ready } = useAppData();
  return useQuery<{ items: ServerAuditLogData[] }>({
    queryKey: serverSettingsKeys.auditLogs(communityId, actionFilter),
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/audit-logs`, {
        signal,
        query: actionFilter ? { action: actionFilter } : undefined,
      }),
    enabled: ready && Boolean(communityId),
  });
}

export function useServerAutoMod(communityId: string) {
  const { api, ready } = useAppData();
  return useQuery<{ items: AutoModRuleData[] }>({
    queryKey: serverSettingsKeys.automod(communityId),
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/automod/rules`, { signal }),
    enabled: ready && Boolean(communityId),
  });
}

export function useCreateAutoModRule(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      enabled?: boolean;
      trigger_type: string;
      trigger_metadata: Record<string, unknown>;
      actions?: string[];
    }) =>
      api.post(
        `/communities/${communityId}/automod/rules`,
        data as unknown as Parameters<typeof api.post>[1],
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.automod(communityId),
      });
    },
  });
}

export function useUpdateAutoModRule(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ruleId,
      ...data
    }: {
      ruleId: string;
      name?: string;
      enabled?: boolean;
      trigger_metadata?: Record<string, unknown>;
      actions?: string[];
    }) =>
      api.patch(
        `/communities/${communityId}/automod/rules/${ruleId}`,
        data as unknown as Parameters<typeof api.patch>[1],
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.automod(communityId),
      });
    },
  });
}

export function useDeleteAutoModRule(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      api.delete<void>(`/communities/${communityId}/automod/rules/${ruleId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.automod(communityId),
      });
    },
  });
}

export function useServerEmojis(communityId: string) {
  const { api, ready } = useAppData();
  return useQuery<{ items: ServerEmojiData[] }>({
    queryKey: serverSettingsKeys.emojis(communityId),
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/emojis`, { signal }),
    enabled: ready && Boolean(communityId),
  });
}

export function useCreateServerEmoji(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; url: string }) =>
      api.post(`/communities/${communityId}/emojis`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.emojis(communityId),
      });
    },
  });
}

export function useDeleteServerEmoji(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emojiId: string) =>
      api.delete<void>(`/communities/${communityId}/emojis/${emojiId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.emojis(communityId),
      });
    },
  });
}

export function useServerStickers(communityId: string) {
  const { api, ready } = useAppData();
  return useQuery<{ items: ServerStickerData[] }>({
    queryKey: serverSettingsKeys.stickers(communityId),
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/stickers`, { signal }),
    enabled: ready && Boolean(communityId),
  });
}

export function useCreateServerSticker(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; url: string }) =>
      api.post(`/communities/${communityId}/stickers`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.stickers(communityId),
      });
    },
  });
}

export function useDeleteServerSticker(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stickerId: string) =>
      api.delete<void>(`/communities/${communityId}/stickers/${stickerId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.stickers(communityId),
      });
    },
  });
}

export function useServerSoundboard(communityId: string) {
  const { api, ready } = useAppData();
  return useQuery<{ items: ServerSoundData[] }>({
    queryKey: serverSettingsKeys.soundboard(communityId),
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/soundboard`, { signal }),
    enabled: ready && Boolean(communityId),
  });
}

export function useCreateServerSoundboard(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; emoji?: string; sound_url: string }) =>
      api.post(`/communities/${communityId}/soundboard`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.soundboard(communityId),
      });
    },
  });
}

export function useDeleteServerSoundboard(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (soundId: string) =>
      api.delete<void>(`/communities/${communityId}/soundboard/${soundId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.soundboard(communityId),
      });
    },
  });
}

export function useServerOnboarding(communityId: string) {
  const { api, ready } = useAppData();
  return useQuery<ServerOnboardingData>({
    queryKey: serverSettingsKeys.onboarding(communityId),
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/onboarding`, { signal }),
    enabled: ready && Boolean(communityId),
  });
}

export function useUpdateServerOnboarding(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ServerOnboardingData>) =>
      api.patch(`/communities/${communityId}/onboarding`, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        serverSettingsKeys.onboarding(communityId),
        updated,
      );
    },
  });
}

export function useServerTemplates(communityId: string) {
  const { api, ready } = useAppData();
  return useQuery<{ items: ServerTemplateData[] }>({
    queryKey: serverSettingsKeys.templates(communityId),
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/templates`, { signal }),
    enabled: ready && Boolean(communityId),
  });
}

export function useCreateServerTemplate(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post(`/communities/${communityId}/templates`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.templates(communityId),
      });
    },
  });
}

export function useDeleteServerTemplate(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      api.delete<void>(`/communities/${communityId}/templates/${templateId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: serverSettingsKeys.templates(communityId),
      });
    },
  });
}

export function useServerTagPreference(communityId: string) {
  const { api, ready } = useAppData();
  return useQuery<{ display_tag: boolean }>({
    queryKey: serverSettingsKeys.tagPreference(communityId),
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/tag-preference`, { signal }),
    enabled: ready && Boolean(communityId),
  });
}

export function useUpdateServerTagPreference(communityId: string) {
  const { api } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (display_tag: boolean) =>
      api.put<{ display_tag: boolean }>(
        `/communities/${communityId}/tag-preference`,
        { display_tag },
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(
        serverSettingsKeys.tagPreference(communityId),
        data,
      );
    },
  });
}
