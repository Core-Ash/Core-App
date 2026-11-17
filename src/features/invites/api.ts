import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { createApiClient, type ApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { apiConfiguration } from "@/lib/env";
import { queryKeys } from "@/features/community/api/hooks";

export const validInviteCode = (code: string) => /^[a-f0-9]{64}$/.test(code);
export interface InviteSettings { expires_in_seconds: number | null; max_uses: number | null }
export interface CreatedInvite { id: string; code: string; url: string; expires_at: string | null; max_uses: number | null; uses: number }
export interface InvitePreview { server: { name: string; icon_url: string | null; banner_url: string | null; description: string | null; member_count: number }; expires_at: string | null }
export interface InviteRecord { id: string; creator: string; created_at: string; expires_at: string | null; max_uses: number | null; uses: number; status: "active" | "expired" | "revoked" | "exhausted" }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("invalid_response");
  return value as Record<string, unknown>;
}
function text(value: unknown): string { if (typeof value !== "string") throw new ApiError("invalid_response"); return value; }
function uuid(value: unknown) { const id = text(value); if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) throw new ApiError("invalid_response"); return id; }
function count(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new ApiError("invalid_response"); return value; }
function date(value: unknown) { if (value === null) return null; const result = text(value); if (!Number.isFinite(Date.parse(result))) throw new ApiError("invalid_response"); return result; }
function image(value: unknown) {
  if (value === null) return null;
  try { const url = new URL(text(value)); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); return url.href; }
  catch { throw new ApiError("invalid_response"); }
}
function boolean(value: unknown) { if (typeof value !== "boolean") throw new ApiError("invalid_response"); return value; }
function uses(value: unknown) { if (value === null) return null; const n = count(value); if (![1, 5, 10, 25, 50, 100].includes(n)) throw new ApiError("invalid_response"); return n; }
export function parsePreview(value: unknown): InvitePreview {
  const data = object(value), server = object(data.server);
  return { server: { name: text(server.name), icon_url: image(server.icon_url), banner_url: image(server.banner_url), description: server.description === null ? null : text(server.description), member_count: count(server.member_count) }, expires_at: date(data.expires_at) };
}
export function parseCreatedInvite(value: unknown): CreatedInvite {
  const data = object(value), code = text(data.code);
  if (!validInviteCode(code)) throw new ApiError("invalid_response");
  const url = new URL(text(data.url));
  if (!(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) || url.username || url.password || url.search || url.hash || url.pathname !== `/invite/${code}`) throw new ApiError("invalid_response");
  return { id: uuid(data.id), code, url: url.href, expires_at: date(data.expires_at), max_uses: uses(data.max_uses), uses: count(data.uses) };
}
function parseStatus(value: unknown) {
  const data = object(value);
  return { already_member: boolean(data.already_member), community_id: data.community_id === null ? null : uuid(data.community_id) };
}
// Public preview never sends cookies or depends on the private session transport.
const publicApi = createApiClient({ baseUrl: apiConfiguration.url, credentials: "omit", sessionSignal: () => new AbortController().signal, onUnauthorized: async () => "expired" });
export const inviteKeys = {
  permissions: (id: string) => ["invite-permissions", id] as const,
  list: (id: string) => ["invites", id] as const,
  link: (id: string) => ["invite-link", id] as const,
};
export function useInvitePreview(code: string) {
  return useQuery({ queryKey: ["invite-preview", code], queryFn: ({ signal }) => publicApi.get(`/invites/${code}`, { signal }).then(parsePreview), enabled: validInviteCode(code), staleTime: 0, gcTime: 0, retry: false, refetchOnMount: "always", refetchOnWindowFocus: true });
}
export function useInvitePermissions(id: string) {
  const { api, ready } = useAppData();
  return useQuery({ queryKey: inviteKeys.permissions(id), enabled: ready && Boolean(id), staleTime: 10_000, refetchOnWindowFocus: true, refetchInterval: 30_000, queryFn: async ({ signal }) => {
    const data = object(await api.get(`/communities/${id}/invite-permissions`, { signal }));
    return { create: boolean(data.create), manage: boolean(data.manage), manage_channels: boolean(data.manage_channels), owner: boolean(data.owner) };
  } });
}
export function useCreateInvite(id: string) {
  const { api, ready } = useAppData(); const queries = useQueryClient();
  return useMutation({ mutationFn: async (settings: InviteSettings) => {
    if (!ready) throw new ApiError("unauthorized");
    return parseCreatedInvite(await api.post(`/communities/${id}/invites`, { ...settings }));
  }, onSuccess: (invite) => { queries.setQueryData(inviteKeys.link(id), invite); void queries.invalidateQueries({ queryKey: inviteKeys.list(id) }); } });
}
export function useInviteStatus(code: string) {
  const { api, ready } = useAppData();
  return useQuery({ queryKey: ["invite-status", code], enabled: ready && validInviteCode(code), staleTime: 0, retry: false, queryFn: ({ signal }) => api.get(`/invites/${code}/status`, { signal }).then(parseStatus) });
}
export function useAcceptInvite(code: string) {
  const { api, ready } = useAppData(); const queries = useQueryClient();
  return useMutation({ mutationFn: async () => {
    if (!ready) throw new ApiError("unauthorized");
    // Idempotent onboarding uses the existing verified Better Auth identity.
    await api.post("/me", {});
    const result = parseStatus(await api.post(`/invites/${code}/accept`, {}));
    if (!result.community_id) throw new ApiError("invalid_response");
    return result.community_id;
  }, onSuccess: async () => {
    await Promise.all([queries.invalidateQueries({ queryKey: queryKeys.communities }), queries.invalidateQueries({ queryKey: queryKeys.profile }), queries.invalidateQueries({ queryKey: ["invite-status", code] })]);
  } });
}
export function useInvites(id: string, enabled: boolean) {
  const { api, ready } = useAppData();
  return useInfiniteQuery({ queryKey: inviteKeys.list(id), enabled: ready && enabled, initialPageParam: null as string | null, getNextPageParam: (page: { items: InviteRecord[]; next_cursor: string | null }) => page.next_cursor ?? undefined,
    queryFn: async ({ pageParam, signal }): Promise<{ items: InviteRecord[]; next_cursor: string | null }> => {
      const data = object(await api.get(`/communities/${id}/invites`, { signal, query: { before: pageParam ?? undefined } }));
      if (!Array.isArray(data.items) || data.items.length > 50) throw new ApiError("invalid_response");
      const items = data.items.map((value): InviteRecord => { const r = object(value); const status = text(r.status); if (!["active", "expired", "revoked", "exhausted"].includes(status)) throw new ApiError("invalid_response");
        return { id: uuid(r.id), creator: text(r.creator), created_at: date(r.created_at) ?? invalid(), expires_at: date(r.expires_at), max_uses: uses(r.max_uses), uses: count(r.uses), status: status as InviteRecord["status"] };
      });
      return { items, next_cursor: data.next_cursor === null ? null : uuid(data.next_cursor) };
    }, refetchOnWindowFocus: true, refetchInterval: 30_000,
  });
}
function invalid(): never { throw new ApiError("invalid_response"); }
export function useRevokeInvite(id: string) {
  const { api, ready } = useAppData(); const queries = useQueryClient();
  return useMutation({ mutationFn: async (inviteId: string) => { if (!ready) throw new ApiError("unauthorized"); await api.delete(`/communities/${id}/invites/${inviteId}`); }, onSuccess: async (_, inviteId) => {
    const link = queries.getQueryData<CreatedInvite>(inviteKeys.link(id));
    if (link?.id === inviteId) { queries.removeQueries({ queryKey: inviteKeys.link(id) }); queries.removeQueries({ queryKey: ["invite-preview", link.code] }); }
    await queries.invalidateQueries({ queryKey: inviteKeys.list(id) });
  } });
}
export async function leaveCommunity(api: ApiClient, id: string) { await api.delete(`/communities/${id}/membership`); }
