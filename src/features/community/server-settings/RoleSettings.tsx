import { useState } from "react";
import { Shield, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useServerRoles,
  useCreateServerRole,
  useUpdateServerRole,
  useDeleteServerRole,
} from "./api";
import type { ServerRoleData, ServerSettingsData } from "./types";

const ALL_PERMISSIONS = [
  { key: "channels.view", label: "View Channels", category: "General", desc: "Allows members to view channels by default." },
  { key: "channels.manage", label: "Manage Channels", category: "General", desc: "Allows members to create, edit, and delete channels." },
  { key: "community.manage", label: "Manage Server", category: "General", desc: "Allows members to change server settings and name." },
  { key: "roles.manage", label: "Manage Roles", category: "General", desc: "Allows members to create, modify, and assign roles." },
  { key: "emojis.manage", label: "Manage Emojis & Stickers", category: "General", desc: "Allows members to add, edit, or remove custom expression media." },
  { key: "audit.view", label: "View Audit Log", category: "General", desc: "Allows members to view the audit log of administrative actions." },
  { key: "invites.create", label: "Create Invites", category: "Membership", desc: "Allows members to create invite links for other users." },
  { key: "invites.manage", label: "Manage Invites", category: "Membership", desc: "Allows members to view and revoke server invitations." },
  { key: "members.manage", label: "Kick Members", category: "Membership", desc: "Allows members to remove members from the server." },
  { key: "bans.manage", label: "Ban Members", category: "Membership", desc: "Allows members to ban and unban members." },
  { key: "messages.send", label: "Send Messages", category: "Text", desc: "Allows members to send messages in text channels." },
  { key: "messages.moderate", label: "Manage Messages", category: "Text", desc: "Allows members to delete messages sent by other members." },
];

export function RoleSettings({
  settings,
  canManage,
}: {
  settings: ServerSettingsData;
  canManage: boolean;
}) {
  const roles = useServerRoles(settings.id);
  const createRole = useCreateServerRole(settings.id);
  const updateRole = useUpdateServerRole(settings.id);
  const deleteRole = useDeleteServerRole(settings.id);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleColor, setRoleColor] = useState("#99aab5");
  const [rolePosition, setRolePosition] = useState(0);
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const items = roles.data?.items ?? [];
  const selectedRole = items.find((r) => r.id === selectedRoleId) ?? items[0];

  const handleSelect = (role: ServerRoleData) => {
    setSelectedRoleId(role.id);
    setRoleName(role.name);
    setRoleColor(role.color ?? "#99aab5");
    setRolePosition(role.position);
    setRolePerms(role.permissions ?? []);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    createRole.mutate(
      { name: newRoleName.trim(), color: "#99aab5", position: items.length },
      {
        onSuccess: (newRole: unknown) => {
          setNewRoleName("");
          setShowCreate(false);
          const r = newRole as { id?: string } | undefined;
          if (r?.id) setSelectedRoleId(r.id);
        },
      }
    );
  };

  const handleSaveRole = () => {
    if (!selectedRole) return;
    updateRole.mutate({
      roleId: selectedRole.id,
      name: roleName.trim() || selectedRole.name,
      color: roleColor,
      position: rolePosition,
      permissions: rolePerms,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="size-5 text-primary" /> Roles
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Use roles to group server members and assign permissions.
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            size="sm"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="size-4 mr-1.5" /> Create Role
          </Button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="p-4 rounded-lg border border-border bg-card space-y-3">
          <div className="text-sm font-semibold text-foreground">Create New Role</div>
          <div className="flex items-center gap-2 max-w-md">
            <Input
              placeholder="e.g. Moderator"
              maxLength={64}
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
            />
            <Button type="submit" disabled={createRole.isPending}>
              Create
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Two column roles interface */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Role list */}
        <div className="space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 pb-1">
            Roles ({items.length})
          </div>
          {items.map((role) => {
            const isSelected = selectedRole?.id === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => handleSelect(role)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors text-left ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-surface-hover text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: role.color || "#99aab5" }}
                  />
                  <span className="truncate">{role.name}</span>
                </div>
                <span className={`text-xs ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {role.member_count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right column: Role Editor */}
        {selectedRole ? (
          <div className="md:col-span-2 space-y-5 p-5 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="font-bold text-foreground">
                Edit Role: {selectedRole.name}
              </div>
              {canManage && selectedRole.name !== "Member" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => deleteRole.mutate(selectedRole.id)}
                >
                  <Trash2 className="size-4 mr-1.5" /> Delete Role
                </Button>
              )}
            </div>

            {/* Role Name & Color */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Role Name
                </label>
                <Input
                  disabled={!canManage}
                  value={roleName || selectedRole.name}
                  maxLength={64}
                  onChange={(e) => setRoleName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Role Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    disabled={!canManage}
                    value={roleColor}
                    onChange={(e) => setRoleColor(e.target.value)}
                    className="size-10 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{roleColor}</span>
                </div>
              </div>
            </div>

            {/* Permission Matrix Toggles */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Permissions
              </div>
              <div className="space-y-3">
                {ALL_PERMISSIONS.map((perm) => {
                  const hasPerm = rolePerms.includes(perm.key);
                  return (
                    <div
                      key={perm.key}
                      className="flex items-start justify-between p-2.5 rounded-lg border border-border/50 bg-background/50"
                    >
                      <div className="pr-4">
                        <div className="text-sm font-medium text-foreground">{perm.label}</div>
                        <div className="text-xs text-muted-foreground">{perm.desc}</div>
                      </div>
                      <Switch
                        disabled={!canManage}
                        checked={hasPerm}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setRolePerms([...rolePerms, perm.key]);
                          } else {
                            setRolePerms(rolePerms.filter((p) => p !== perm.key));
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {canManage && (
              <div className="pt-3 border-t border-border flex justify-end">
                <Button
                  type="button"
                  disabled={updateRole.isPending}
                  onClick={handleSaveRole}
                >
                  Save Role Changes
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="md:col-span-2 py-12 text-center text-sm text-muted-foreground">
            Select a role to configure permissions.
          </div>
        )}
      </div>
    </div>
  );
}
