import { useState } from "react";
import { Users, Search, UserX, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/common/UserAvatar";
import { useAppData } from "@/app/app-data-context";
import { useQuery } from "@tanstack/react-query";
import {
  useServerRoles,
  useUpdateMemberRoles,
  useKickMember,
  useBanMember,
} from "./api";
import type { ServerMember } from "@/lib/api/types";
import type { ServerSettingsData } from "./types";

export function MemberSettings({
  settings,
  canManage,
}: {
  settings: ServerSettingsData;
  canManage: boolean;
}) {
  const { api, ready } = useAppData();
  const [search, setSearch] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banningUser, setBanningUser] = useState<ServerMember | null>(null);
  const [editingRoleUser, setEditingRoleUser] = useState<ServerMember | null>(null);

  const rolesQuery = useServerRoles(settings.id);
  const updateMemberRoles = useUpdateMemberRoles(settings.id);
  const kickMember = useKickMember(settings.id);
  const banMember = useBanMember(settings.id);

  const membersQuery = useQuery<{ items: ServerMember[]; total: number }>({
    queryKey: ["members", settings.id, search],
    queryFn: ({ signal }) =>
      api.get(`/communities/${settings.id}/members`, {
        signal,
        query: search.trim() ? { search: search.trim() } : undefined,
      }),
    enabled: ready && Boolean(settings.id),
  });

  const members = membersQuery.data?.items ?? [];
  const serverRoles = rolesQuery.data?.items ?? [];

  const handleKick = (member: ServerMember) => {
    if (window.confirm(`Are you sure you want to kick ${member.display_name}?`)) {
      kickMember.mutate(member.id);
    }
  };

  const handleConfirmBan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!banningUser) return;
    banMember.mutate(
      { userId: banningUser.id, reason: banReason.trim() || undefined },
      {
        onSuccess: () => {
          setBanningUser(null);
          setBanReason("");
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="size-5 text-primary" /> Community members
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage server participants and role memberships.
          </p>
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          {membersQuery.data?.total ?? members.length} Total Members
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-background/50"
        />
      </div>

      {/* Members Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-neutral-900/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="py-3 px-4">Member</th>
              <th className="py-3 px-4">Roles</th>
              <th className="py-3 px-4">Joined</th>
              {canManage && <th className="py-3 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-sm">
            {members.map((member) => {
              const isOwner = member.id === settings.owner_id;
              const joined = new Date(member.joined_at);
              const formattedDate = !isNaN(joined.getTime())
                ? joined.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "—";

              return (
                <tr key={member.id} className="hover:bg-surface-hover/50 transition-colors">
                  {/* Member Name & Avatar */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        user={{
                          name: member.display_name,
                          image: member.avatar_url,
                          email: member.username,
                        }}
                        className="size-8"
                      />
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{member.display_name}</span>
                          {isOwner && (
                            <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                              Owner
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          @{member.username}
                          {member.discriminator ? `#${member.discriminator}` : ""}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Roles badges */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-1">
                      {member.roles?.map((r) => (
                        <span
                          key={r.id}
                          className="px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1"
                          style={{
                            borderColor: `${r.color || "#99aab5"}60`,
                            backgroundColor: `${r.color || "#99aab5"}15`,
                            color: r.color || "#99aab5",
                          }}
                        >
                          <span
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: r.color || "#99aab5" }}
                          />
                          {r.name}
                        </span>
                      ))}
                      {(!member.roles || member.roles.length === 0) && (
                        <span className="text-xs text-muted-foreground">No roles</span>
                      )}
                      {canManage && !isOwner && (
                        <button
                          type="button"
                          className="size-5 rounded-full border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary flex items-center justify-center text-xs"
                          title="Assign roles"
                          onClick={() => setEditingRoleUser(member)}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Joined Date */}
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {formattedDate}
                  </td>

                  {/* Actions */}
                  {canManage && (
                    <td className="py-3 px-4 text-right">
                      {!isOwner ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => handleKick(member)}
                            title="Kick member"
                          >
                            <UserX className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setBanningUser(member)}
                            title="Ban member"
                          >
                            <Ban className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Owner</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No members found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Role Assignment Modal */}
      {editingRoleUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-popover border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="font-bold text-foreground">
              Manage Roles for {editingRoleUser.display_name}
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {serverRoles.map((role) => {
                const hasRole = editingRoleUser.roles?.some((r) => r.id === role.id);
                return (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-surface-hover cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={hasRole}
                      onChange={(e) => {
                        const currentRoleIds = editingRoleUser.roles?.map((r) => r.id) ?? [];
                        const nextIds = e.target.checked
                          ? [...currentRoleIds, role.id]
                          : currentRoleIds.filter((id) => id !== role.id);

                        updateMemberRoles.mutate(
                          { userId: editingRoleUser.id, roleIds: nextIds },
                          {
                            onSuccess: () => {
                              setEditingRoleUser({
                                ...editingRoleUser,
                                roles: serverRoles.filter((r) => nextIds.includes(r.id)),
                              });
                            },
                          }
                        );
                      }}
                      className="rounded border-border"
                    />
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: role.color || "#99aab5" }}
                    />
                    <span>{role.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end pt-2 border-t border-border">
              <Button type="button" onClick={() => setEditingRoleUser(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Dialog */}
      {banningUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmBan}
            className="bg-popover border border-border rounded-xl p-5 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="font-bold text-destructive flex items-center gap-2">
              <Ban className="size-5" /> Ban {banningUser.display_name}
            </div>
            <p className="text-xs text-muted-foreground">
              Banning this user will remove their membership and prevent them from rejoining through invite links.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">Reason for Ban</label>
              <Input
                placeholder="Violation of server rules..."
                maxLength={512}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setBanningUser(null);
                  setBanReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={banMember.isPending}
              >
                Confirm Ban
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
