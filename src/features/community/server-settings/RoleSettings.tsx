import { useState, useMemo } from "react";
import {
  Plus,
  Pencil,
  MoreHorizontal,
  Trash2,
  Copy,
  Users,
  Search,
  ChevronRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import * as Dialog from "@radix-ui/react-dialog";
import {
  useServerRoles,
  useCreateServerRole,
  useUpdateServerRole,
  useDeleteServerRole,
  useReorderServerRoles,
  useRoleMembers,
  useAddRoleMember,
  useRemoveRoleMember,
} from "./api";
import { useQuery } from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { RoleListSkeleton } from "@/components/common/skeleton/Skeletons";
import type { ServerMember } from "@/lib/api/types";
import type { ServerRoleData, ServerSettingsData } from "./types";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api/errors";

const DISCORD_PALETTE = [
  "#1abc9c", "#2ecc71", "#3498db", "#9b59b6", "#e91e63", "#f1c40f",
  "#e67e22", "#e74c3c", "#95a5a6", "#607d8b", "#11806a", "#1f8b4c",
  "#206694", "#71368a", "#ad1457", "#c27c0e", "#a84300", "#992d22",
];

interface PermissionDef {
  key: string;
  label: string;
  desc: string;
  dangerous?: boolean;
}

interface PermissionGroupDef {
  category: string;
  permissions: PermissionDef[];
}

const PERMISSION_GROUPS: PermissionGroupDef[] = [
  {
    category: "General Server Permissions",
    permissions: [
      { key: "channels.view", label: "View Channels", desc: "Allows members to view channels by default (excluding private channels)." },
      { key: "channels.manage", label: "Manage Channels", desc: "Allows members to create, edit, or delete channels and categories." },
      { key: "roles.manage", label: "Manage Roles", desc: "Allows members to create new roles and edit or delete roles below their highest role." },
      { key: "emojis.manage", label: "Manage Expressions", desc: "Allows members to add or delete custom emojis, stickers, and soundboard sounds." },
      { key: "audit.view", label: "View Audit Log", desc: "Allows members to view the audit log of administrative actions taken on the server." },
      { key: "community.manage", label: "Manage Server", desc: "Allows members to change the server's name, description, and settings." },
    ],
  },
  {
    category: "Membership Permissions",
    permissions: [
      { key: "invites.create", label: "Create Invites", desc: "Allows members to create instant invite links to this server." },
      { key: "invites.manage", label: "Manage Invites", desc: "Allows members to view and revoke existing server invites." },
      { key: "members.manage", label: "Kick Members", desc: "Allows members to remove other members below their highest role from the server." },
      { key: "bans.manage", label: "Ban Members", desc: "Allows members to ban other members below their highest role from the server." },
    ],
  },
  {
    category: "Text Channel Permissions",
    permissions: [
      { key: "messages.send", label: "Send Messages", desc: "Allows members to send messages in text channels." },
      { key: "messages.moderate", label: "Manage Messages", desc: "Allows members to delete messages sent by other members or pin messages." },
    ],
  },
  {
    category: "Advanced Permissions",
    permissions: [
      {
        key: "administrator",
        label: "Administrator",
        desc: "Members with this permission have access to all server permissions and can bypass channel-specific permission restrictions (including viewing private channels). Granting this permission is dangerous.",
        dangerous: true,
      },
    ],
  },
];

export function RoleSettings({
  settings,
  canManage,
}: {
  settings: ServerSettingsData;
  canManage: boolean;
}) {
  const rolesQuery = useServerRoles(settings.id);
  const createRole = useCreateServerRole(settings.id);
  const reorderRoles = useReorderServerRoles(settings.id);

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [contextMenuRoleId, setContextMenuRoleId] = useState<string | null>(null);
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<ServerRoleData | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Drag and drop state
  const [draggedRoleId, setDraggedRoleId] = useState<string | null>(null);
  const [dragOverRoleId, setDragOverRoleId] = useState<string | null>(null);

  const items = rolesQuery.data?.items ?? [];
  const defaultRole = items.find((r) => r.is_default);
  const customRoles = items.filter((r) => !r.is_default);

  const filteredRoles = useMemo(() => {
    if (!search.trim()) return customRoles;
    const lower = search.toLowerCase();
    return customRoles.filter((r) => r.name.toLowerCase().includes(lower));
  }, [customRoles, search]);

  const handleCreateRole = async () => {
    try {
      const highestPos = customRoles.reduce((max, r) => Math.max(max, r.position), 0);
      const res = await createRole.mutateAsync({
        name: "new role",
        color: "#99aab5",
        position: highestPos + 1,
        permissions: ["channels.view", "messages.send"],
      });
      const created = res as { id: string };
      if (created?.id) {
        setEditingRoleId(created.id);
      }
    } catch {
      // handled
    }
  };

  const handleDragEnd = async () => {
    if (!draggedRoleId || !dragOverRoleId || draggedRoleId === dragOverRoleId) {
      setDraggedRoleId(null);
      setDragOverRoleId(null);
      return;
    }

    const currentOrder = [...customRoles];
    const sourceIdx = currentOrder.findIndex((r) => r.id === draggedRoleId);
    const targetIdx = currentOrder.findIndex((r) => r.id === dragOverRoleId);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      const [moving] = currentOrder.splice(sourceIdx, 1);
      if (moving) {
        currentOrder.splice(targetIdx, 0, moving);
        const orderIds = currentOrder.map((r) => r.id);
        void reorderRoles.mutateAsync(orderIds);
      }
    }

    setDraggedRoleId(null);
    setDragOverRoleId(null);
  };

  // If editing a role, render the 3-column Discord Role Editor
  if (editingRoleId) {
    const roleToEdit = items.find((r) => r.id === editingRoleId) ?? defaultRole;
    if (roleToEdit) {
      return (
        <RoleEditorView
          communityId={settings.id}
          roles={items}
          selectedRole={roleToEdit}
          canManage={canManage}
          onSelectRole={(r) => setEditingRoleId(r.id)}
          onBack={() => setEditingRoleId(null)}
          onCreateRole={handleCreateRole}
        />
      );
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Roles</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Use roles to organize your server members and customize their permissions.
        </p>
      </div>

      {/* Default Permissions Panel (@everyone) */}
      {defaultRole && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setEditingRoleId(defaultRole.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setEditingRoleId(defaultRole.id);
            }
          }}
          className="flex items-center justify-between p-4 rounded-xl border border-border/80 bg-card/60 hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              <Users size={20} />
            </div>
            <div>
              <div className="font-semibold text-foreground">Default Permissions</div>
              <div className="text-xs text-muted-foreground">
                @everyone • applies to all members of the server
              </div>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted-foreground" />
        </div>
      )}

      {/* Search and Create Role */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles"
            className="pl-9 h-10 bg-background"
          />
        </div>
        {canManage && (
          <Button
            type="button"
            onClick={handleCreateRole}
            disabled={createRole.isPending}
            className="gap-2"
          >
            <Plus size={16} /> Create Role
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground leading-relaxed">
        Members use the color of the highest role they have on this list. Drag roles to reorder their hierarchy.
      </div>

      {/* Roles List Table */}
      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span>Roles — {customRoles.length}</span>
          <span>Members</span>
        </div>

        <div className="divide-y divide-border/60">
          {rolesQuery.isPending ? (
            <RoleListSkeleton rows={4} />
          ) : filteredRoles.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {search.trim() ? "No roles match your search." : "No custom roles created yet."}
            </div>
          ) : (
            filteredRoles.map((role) => (
              <div
                key={role.id}
                draggable={canManage}
                onDragStart={() => setDraggedRoleId(role.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (canManage && draggedRoleId !== role.id) {
                    setDragOverRoleId(role.id);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverRoleId === role.id) setDragOverRoleId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleDragEnd();
                }}
                className={cn(
                  "flex items-center justify-between px-4 py-3 hover:bg-surface-hover/60 transition-colors group relative",
                  dragOverRoleId === role.id && "border-t-2 border-primary bg-primary/5",
                  draggedRoleId === role.id && "opacity-40",
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {canManage && (
                    <GripVertical
                      size={16}
                      className="text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab shrink-0"
                    />
                  )}
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: role.color || "#99aab5" }}
                  />
                  <span className="font-medium text-foreground truncate">{role.name}</span>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{role.member_count}</span>
                    <Users size={14} />
                  </span>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingRoleId(role.id)}
                        className="size-8 p-0"
                        title="Edit Role"
                      >
                        <Pencil size={15} />
                      </Button>

                      <div className="relative">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setContextMenuRoleId(contextMenuRoleId === role.id ? null : role.id)
                          }
                          className="size-8 p-0"
                          title="More Actions"
                        >
                          <MoreHorizontal size={15} />
                        </Button>

                        {contextMenuRoleId === role.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-popover shadow-xl z-50 py-1 text-sm animate-in fade-in zoom-in-95">
                            <button
                              type="button"
                              onClick={() => {
                                setContextMenuRoleId(null);
                                setEditingRoleId(role.id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left"
                            >
                              <Pencil size={14} /> Edit Role
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setContextMenuRoleId(null);
                                void navigator.clipboard.writeText(role.id);
                                setCopyFeedback(role.id);
                                setTimeout(() => setCopyFeedback(null), 2000);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left"
                            >
                              <Copy size={14} />
                              {copyFeedback === role.id ? "Copied!" : "Copy Role ID"}
                            </button>
                            <div className="my-1 border-t border-border" />
                            <button
                              type="button"
                              onClick={() => {
                                setContextMenuRoleId(null);
                                setDeleteConfirmRole(role);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-destructive hover:bg-destructive/10 text-left"
                            >
                              <Trash2 size={14} /> Delete Role
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Role Confirmation Dialog */}
      {deleteConfirmRole && (
        <DeleteRoleDialog
          communityId={settings.id}
          role={deleteConfirmRole}
          open={Boolean(deleteConfirmRole)}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirmRole(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discord-Style Role Editor (Three-Column Layout: Navigation | Roles | Editor)
// ---------------------------------------------------------------------------

function RoleEditorView({
  communityId,
  roles,
  selectedRole,
  canManage,
  onSelectRole,
  onBack,
  onCreateRole,
}: {
  communityId: string;
  roles: ServerRoleData[];
  selectedRole: ServerRoleData;
  canManage: boolean;
  onSelectRole: (role: ServerRoleData) => void;
  onBack: () => void;
  onCreateRole: () => void;
}) {
  const updateRole = useUpdateServerRole(communityId);

  const [activeTab, setActiveTab] = useState<"display" | "permissions" | "links" | "members">(selectedRole.is_default ? "permissions" : "display");

  // Draft changes
  const [draftName, setDraftName] = useState(selectedRole.name);
  const [draftColor, setDraftColor] = useState(selectedRole.color || "#99aab5");
  const [draftHoist, setDraftHoist] = useState(Boolean(selectedRole.hoist));
  const [draftMentionable, setDraftMentionable] = useState(Boolean(selectedRole.mentionable));
  const [draftPerms, setDraftPerms] = useState<string[]>(selectedRole.permissions || []);
  const [permSearch, setPermSearch] = useState("");
  const [adminConfirmOpen, setAdminConfirmOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync draft when selectedRole changes
  const handleRoleSwitch = (target: ServerRoleData) => {
    if (target.id === selectedRole.id) return;
    onSelectRole(target);
    setActiveTab(target.is_default ? "permissions" : "display");
    setDraftName(target.name);
    setDraftColor(target.color || "#99aab5");
    setDraftHoist(Boolean(target.hoist));
    setDraftMentionable(Boolean(target.mentionable));
    setDraftPerms(target.permissions || []);
    setHasChanges(false);
  };

  const markDirty = () => setHasChanges(true);

  const handleReset = () => {
    setDraftName(selectedRole.name);
    setDraftColor(selectedRole.color || "#99aab5");
    setDraftHoist(Boolean(selectedRole.hoist));
    setDraftMentionable(Boolean(selectedRole.mentionable));
    setDraftPerms(selectedRole.permissions || []);
    setHasChanges(false);
  };

  const handleSave = async () => {
    try {
      await updateRole.mutateAsync({
        roleId: selectedRole.id,
        name: selectedRole.is_default ? undefined : draftName.trim(),
        color: selectedRole.is_default ? undefined : draftColor,
        hoist: selectedRole.is_default ? undefined : draftHoist,
        mentionable: selectedRole.is_default ? undefined : draftMentionable,
        permissions: draftPerms,
      });
      setHasChanges(false);
    } catch {
      // error handled
    }
  };

  const isDefaultRole = Boolean(selectedRole.is_default);

  return (
    <div className="flex h-full min-h-[600px] border border-border rounded-xl overflow-hidden bg-background">
      {/* Middle Column: Role List Sidebar */}
      <div className="w-60 border-r border-border bg-card/30 flex flex-col shrink-0">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft size={14} /> Back
          </Button>
          {canManage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCreateRole}
              className="size-8 p-0"
              title="Create Role"
            >
              <Plus size={16} />
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {roles.map((r) => {
            const isSelected = r.id === selectedRole.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRoleSwitch(r)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left font-medium transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: r.color || "#99aab5" }}
                />
                <span className="truncate flex-1">{r.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Selected Role Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-y-auto">
        <header className="p-6 pb-0 border-b border-border bg-card/10">
          <h2 className="text-xl font-bold text-foreground">
            Edit Role — {selectedRole.name}
          </h2>

          <div className="flex items-center gap-6 mt-4 border-b border-transparent">
            {(["display", "permissions", "links", "members"] as const).filter(tab => !isDefaultRole || tab === "permissions").map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "pb-3 text-sm font-semibold capitalize transition-colors relative",
                  activeTab === tab
                    ? "text-foreground border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab === "display" && "Display"}
                {tab === "permissions" && "Permissions"}
                {tab === "links" && "Links"}
                {tab === "members" && `Manage Members (${selectedRole.member_count})`}
              </button>
            ))}
          </div>
        </header>

        <div className="p-6 space-y-6 flex-1 pb-24">
          {/* TAB 1: DISPLAY */}
          {activeTab === "display" && (
            <div className="space-y-6 max-w-xl">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Role Name {isDefaultRole && "(Fixed for @everyone)"}
                </label>
                <Input
                  disabled={!canManage || isDefaultRole}
                  value={draftName}
                  maxLength={64}
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    markDirty();
                  }}
                  className="h-10 bg-background"
                />
              </div>

              {/* Role Color Picker */}
              {!isDefaultRole && (
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Role Color
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Members use the color of the highest role they have on this list.
                  </p>

                  <div className="grid grid-cols-9 gap-2">
                    {DISCORD_PALETTE.map((hex) => {
                      const selected = draftColor.toLowerCase() === hex.toLowerCase();
                      return (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => {
                            setDraftColor(hex);
                            markDirty();
                          }}
                          className={cn(
                            "size-8 rounded-md flex items-center justify-center transition-transform hover:scale-105",
                            selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                          )}
                          style={{ backgroundColor: hex }}
                          title={hex}
                        >
                          {selected && <Check size={16} className="text-white drop-shadow" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="color"
                      disabled={!canManage}
                      value={draftColor}
                      onChange={(e) => {
                        setDraftColor(e.target.value);
                        markDirty();
                      }}
                      className="size-9 rounded-md border border-border cursor-pointer bg-transparent"
                    />
                    <Input
                      disabled={!canManage}
                      value={draftColor}
                      maxLength={7}
                      onChange={(e) => {
                        setDraftColor(e.target.value);
                        markDirty();
                      }}
                      className="w-28 font-mono text-xs uppercase bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDraftColor("#99aab5");
                        markDirty();
                      }}
                    >
                      Default
                    </Button>
                  </div>
                </div>
              )}

              {/* Live Chat Preview */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Role Preview
                </span>
                <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center">
                      U
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm" style={{ color: draftColor }}>
                          Username
                        </span>
                        <span className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded font-bold uppercase">
                          {draftName || selectedRole.name}
                        </span>
                        <span className="text-xs text-muted-foreground">Today at 12:00 PM</span>
                      </div>
                      <p className="text-sm text-foreground/90 mt-0.5">
                        Here is what chat messages will look like with this role color applied!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Display Options */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      Display role members separately from online members
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Show members with this role in a separate group in the server member list.
                    </div>
                  </div>
                  <Switch
                    disabled={!canManage}
                    checked={draftHoist}
                    onCheckedChange={(checked) => {
                      setDraftHoist(checked);
                      markDirty();
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      Allow anyone to @mention this role
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Members can ping everyone with this role in chat messages.
                    </div>
                  </div>
                  <Switch
                    disabled={!canManage}
                    checked={draftMentionable}
                    onCheckedChange={(checked) => {
                      setDraftMentionable(checked);
                      markDirty();
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PERMISSIONS */}
          {activeTab === "permissions" && (
            <div className="space-y-6 max-w-2xl">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Search permissions"
                  className="pl-9 h-10 bg-background"
                />
              </div>

              <div className="space-y-6">
                {PERMISSION_GROUPS.map((group) => {
                  const filtered = group.permissions.filter((p) => {
                    if (!permSearch.trim()) return true;
                    const q = permSearch.toLowerCase();
                    return p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
                  });

                  if (filtered.length === 0) return null;

                  return (
                    <div key={group.category} className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {group.category}
                      </h3>

                      <div className="rounded-xl border border-border divide-y divide-border/60 bg-card/30">
                        {filtered.map((perm) => {
                          const enabled = draftPerms.includes(perm.key);
                          return (
                            <div
                              key={perm.key}
                              className={cn(
                                "flex items-start justify-between p-4 transition-colors",
                                perm.dangerous && "bg-destructive/5",
                              )}
                            >
                              <div className="pr-4 min-w-0">
                                <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                  {perm.label}
                                  {perm.dangerous && (
                                    <AlertTriangle size={14} className="text-destructive" />
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                  {perm.desc}
                                </div>
                              </div>
                              <Switch
                                disabled={!canManage || updateRole.isPending || (isDefaultRole && perm.key === "administrator")}
                                aria-label={perm.label}
                                checked={enabled}
                                onCheckedChange={(checked) => {
                                  if (perm.dangerous && checked) {
                                    setAdminConfirmOpen(true);
                                  } else {
                                    if (checked) {
                                      setDraftPerms([...draftPerms, perm.key]);
                                    } else {
                                      setDraftPerms(draftPerms.filter((k) => k !== perm.key));
                                    }
                                    markDirty();
                                  }
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: LINKS */}
          {activeTab === "links" && (
            <div className="max-w-xl space-y-4 text-sm text-muted-foreground">
              <p>
                Role links allow third-party bots and apps to associate verified external accounts with this role.
              </p>
              <div className="p-4 rounded-xl border border-border bg-card/30 text-xs">
                No external verification applications are linked to this server yet.
              </div>
            </div>
          )}

          {/* TAB 4: MANAGE MEMBERS */}
          {activeTab === "members" && (
            <RoleMembersManager
              communityId={communityId}
              role={selectedRole}
              canManage={canManage}
            />
          )}
        </div>

        {/* Unsaved Changes Floating Bar */}
        {updateRole.isError && <p role="alert" className="px-6 py-3 text-sm text-destructive">{apiErrorMessage(updateRole.error)} Your draft is preserved.</p>}
        {hasChanges && (
          <div className="sticky bottom-4 left-6 right-6 mx-6 p-3 rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl flex items-center justify-between z-40 animate-in slide-in-from-bottom-2">
            <span className="text-sm font-medium text-foreground">
              Careful — you have unsaved changes!
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
                Reset
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={updateRole.isPending}
              >
                {updateRole.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dangerous Administrator Confirmation Dialog */}
      <Dialog.Root open={adminConfirmOpen} onOpenChange={setAdminConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="standard-dialog max-w-md w-full bg-popover text-popover-foreground p-6 rounded-xl shadow-2xl border border-border space-y-4">
            <div className="flex items-center gap-3 text-destructive font-bold text-lg">
              <AlertTriangle className="size-6 shrink-0" />
              <span>Enable Administrator Permission?</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Members with this permission will have access to <strong>all server permissions</strong> and will be able to <strong>bypass all channel-specific restrictions</strong> (including viewing every private channel and category).
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAdminConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  setDraftPerms((prev) => [...prev, "administrator"]);
                  markDirty();
                  setAdminConfirmOpen(false);
                }}
              >
                Confirm & Enable
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role Members Manager Sub-Component
// ---------------------------------------------------------------------------

function RoleMembersManager({
  communityId,
  role,
  canManage,
}: {
  communityId: string;
  role: ServerRoleData;
  canManage: boolean;
}) {
  const { api, ready } = useAppData();
  const roleMembers = useRoleMembers(communityId, role.id);
  const addRoleMember = useAddRoleMember(communityId);
  const removeRoleMember = useRemoveRoleMember(communityId);

  const [memberSearch, setMemberSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const communityMembersQuery = useQuery<{ items: ServerMember[]; total: number }>({
    queryKey: ["members", communityId],
    queryFn: ({ signal }) =>
      api.get(`/communities/${communityId}/members`, { signal }),
    enabled: ready && Boolean(communityId),
  });

  const assignedMembers = useMemo(() => roleMembers.data ?? [], [roleMembers.data]);
  const allMembers = useMemo(() => communityMembersQuery.data?.items ?? [], [communityMembersQuery.data?.items]);

  const filteredAssigned = useMemo(() => {
    if (!memberSearch.trim()) return assignedMembers;
    const q = memberSearch.toLowerCase();
    return assignedMembers.filter(
      (m: import("./types").RoleMemberData) =>
        m.username.toLowerCase().includes(q) ||
        m.display_name.toLowerCase().includes(q),
    );
  }, [assignedMembers, memberSearch]);

  const candidatesToAdd = useMemo(() => {
    const assignedIds = new Set(assignedMembers.map((m: import("./types").RoleMemberData) => m.id));
    return allMembers.filter((m: ServerMember) => !assignedIds.has(m.id));
  }, [allMembers, assignedMembers]);

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search members"
            className="pl-9 h-10 bg-background"
          />
        </div>
        {canManage && (
          <Button
            type="button"
            onClick={() => setAddDialogOpen(true)}
            size="sm"
            className="gap-1.5"
          >
            <Plus size={15} /> Add Members
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border divide-y divide-border/60 bg-card/30">
        {filteredAssigned.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No members are currently assigned to this role.
          </div>
        ) : (
          filteredAssigned.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 px-4 hover:bg-surface-hover/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs overflow-hidden">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.display_name}
                      className="size-full object-cover"
                    />
                  ) : (
                    member.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">
                    {member.display_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{member.username}
                  </div>
                </div>
              </div>

              {canManage && !role.is_default && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    removeRoleMember.mutate({ roleId: role.id, userId: member.id })
                  }
                  className="size-8 p-0 text-muted-foreground hover:text-destructive"
                  title="Remove from role"
                >
                  <Trash2 size={15} />
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Member Modal */}
      <Dialog.Root open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="standard-dialog max-w-md w-full bg-popover text-popover-foreground p-6 rounded-xl shadow-2xl border border-border space-y-4">
            <Dialog.Title className="text-lg font-bold text-foreground">
              Add Members to {role.name}
            </Dialog.Title>
            <div className="max-h-60 overflow-y-auto divide-y divide-border/60 border border-border rounded-lg">
              {candidatesToAdd.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  All community members already have this role.
                </div>
              ) : (
                candidatesToAdd.map((cand) => (
                  <div
                    key={cand.id}
                    className="flex items-center justify-between p-2.5 px-3 hover:bg-surface-hover"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {cand.display_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        @{cand.username}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        addRoleMember.mutate({ roleId: role.id, userId: cand.id });
                      }}
                      disabled={addRoleMember.isPending}
                    >
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button type="button" variant="ghost" onClick={() => setAddDialogOpen(false)}>
                Done
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Role Dialog
// ---------------------------------------------------------------------------

function DeleteRoleDialog({
  communityId,
  role,
  open,
  onOpenChange,
}: {
  communityId: string;
  role: ServerRoleData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteRole = useDeleteServerRole(communityId);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setError(null);
      await deleteRole.mutateAsync(role.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="standard-dialog max-w-sm w-full bg-popover text-popover-foreground p-6 rounded-xl shadow-2xl border border-border space-y-4">
          <Dialog.Title className="text-lg font-bold text-foreground">
            Delete Role
          </Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground leading-relaxed">
            Are you sure you want to delete <strong className="text-foreground">{role.name}</strong>? This will remove the role from all {role.member_count} assigned members. This action cannot be undone.
          </Dialog.Description>
          {error && <p className="text-xs text-destructive font-medium">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteRole.isPending}
            >
              {deleteRole.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
