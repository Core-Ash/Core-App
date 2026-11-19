import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { endpoints } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/features/community/api/hooks";

export const categoryQueryKeys = {
  categories: (communityId: string | undefined) => ["categories", communityId] as const,
  preferences: (communityId: string | undefined) => ["community-preferences", communityId] as const,
};

export function useCategories(communityId?: string) {
  const { api, ready } = useAppData();
  return useQuery({
    queryKey: categoryQueryKeys.categories(communityId),
    queryFn: ({ signal }) => endpoints.categories(api, communityId!, signal),
    enabled: ready && Boolean(communityId),
  });
}

export function useCreateCategory(communityId?: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; is_private?: boolean; roles?: string[] }) => {
      if (!ready || !communityId) throw new ApiError("unauthorized");
      return endpoints.createCategory(api, communityId, payload);
    },
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: categoryQueryKeys.categories(communityId) });
      void queries.invalidateQueries({ queryKey: queryKeys.channels(communityId) });
    },
  });
}

export function useUpdateCategory(communityId?: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: ({
      categoryId,
      ...payload
    }: {
      categoryId: string;
      name?: string;
      is_private?: boolean;
      position?: number;
      roles?: string[];
    }) => {
      if (!ready || !communityId) throw new ApiError("unauthorized");
      return endpoints.updateCategory(api, communityId, categoryId, payload);
    },
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: categoryQueryKeys.categories(communityId) });
      void queries.invalidateQueries({ queryKey: queryKeys.channels(communityId) });
    },
  });
}

export function useDeleteCategory(communityId?: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) => {
      if (!ready || !communityId) throw new ApiError("unauthorized");
      return endpoints.deleteCategory(api, communityId, categoryId);
    },
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: categoryQueryKeys.categories(communityId) });
      void queries.invalidateQueries({ queryKey: queryKeys.channels(communityId) });
    },
  });
}

export function useReorderCategories(communityId?: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (order: string[]) => {
      if (!ready || !communityId) throw new ApiError("unauthorized");
      return endpoints.reorderCategories(api, communityId, order);
    },
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: categoryQueryKeys.categories(communityId) });
    },
  });
}

export function useReorderChannels(communityId?: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; category_id: string | null; position: number }[]) => {
      if (!ready || !communityId) throw new ApiError("unauthorized");
      return endpoints.reorderChannels(api, communityId, items);
    },
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: queryKeys.channels(communityId) });
      void queries.invalidateQueries({ queryKey: categoryQueryKeys.categories(communityId) });
    },
  });
}

export function useUpdateChannel(communityId?: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: ({
      channelId,
      ...payload
    }: {
      channelId: string;
      name?: string;
      topic?: string;
      category_id?: string | null;
      position?: number;
    }) => {
      if (!ready || !communityId) throw new ApiError("unauthorized");
      return endpoints.updateChannel(api, communityId, channelId, payload);
    },
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: queryKeys.channels(communityId) });
    },
  });
}

export function useSetCommunityPreferences(communityId?: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (payload: { hide_muted_channels: boolean }) => {
      if (!ready || !communityId) throw new ApiError("unauthorized");
      return endpoints.setCommunityPreferences(api, communityId, payload);
    },
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: categoryQueryKeys.categories(communityId) });
    },
  });
}

export function useSetChannelMute(channelId?: string, communityId?: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (isMuted: boolean) => {
      if (!ready || !channelId) throw new ApiError("unauthorized");
      return endpoints.setChannelMute(api, channelId, isMuted);
    },
    onSuccess: () => {
      if (communityId) {
        void queries.invalidateQueries({ queryKey: queryKeys.channels(communityId) });
      }
    },
  });
}

export function useSetCategoryMute(categoryId?: string, communityId?: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (isMuted: boolean) => {
      if (!ready || !categoryId) throw new ApiError("unauthorized");
      return endpoints.setCategoryMute(api, categoryId, isMuted);
    },
    onSuccess: () => {
      if (communityId) {
        void queries.invalidateQueries({ queryKey: categoryQueryKeys.categories(communityId) });
      }
    },
  });
}

export function useSetCategoryCollapse(categoryId?: string, communityId?: string) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: (isCollapsed: boolean) => {
      if (!ready || !categoryId) throw new ApiError("unauthorized");
      return endpoints.setCategoryCollapse(api, categoryId, isCollapsed);
    },
    onSuccess: () => {
      if (communityId) {
        void queries.invalidateQueries({ queryKey: categoryQueryKeys.categories(communityId) });
      }
    },
  });
}
