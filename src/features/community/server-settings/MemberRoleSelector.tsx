import { useState, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, Search, ShieldAlert } from "lucide-react";
import { useServerRoles, useAddRoleMember, useRemoveRoleMember } from "./api";
import { cn } from "@/lib/utils";

interface MemberRoleSelectorProps {
  communityId: string;
  targetUserId: string;
  targetUserName?: string;
  assignedRoleIds: string[];
  canManage: boolean;
  isTargetOwner?: boolean;
  trigger: React.ReactNode;
  align?: "start" | "end" | "center";
  side?: "top" | "bottom" | "left" | "right";
  onRoleToggled?: (roleId: string, added: boolean) => void;
}

export function MemberRoleSelector({
  communityId,
  targetUserId,
  assignedRoleIds,
  canManage,
  trigger,
  align = "start",
  side = "bottom",
  onRoleToggled,
}: MemberRoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, boolean>>({});

  // Compute effective assigned roles by merging assignedRoleIds with active optimistic overrides
  const effectiveAssignedIds = useMemo(() => {
    const set = new Set(assignedRoleIds);
    for (const [roleId, isAdded] of Object.entries(optimisticOverrides)) {
      if (isAdded) set.add(roleId);
      else set.delete(roleId);
    }
    return Array.from(set);
  }, [assignedRoleIds, optimisticOverrides]);

  const rolesQuery = useServerRoles(communityId);
  const addRoleMember = useAddRoleMember(communityId);
  const removeRoleMember = useRemoveRoleMember(communityId);

  // All roles for this community, memoized to preserve array reference
  const roles = useMemo(() => rolesQuery.data?.items ?? [], [rolesQuery.data?.items]);

  // Filter out @everyone (is_default) and filter by search
  const assignableRoles = useMemo(() => {
    return roles
      .filter((r) => !r.is_default && r.name !== "@everyone")
      .sort((a, b) => b.position - a.position);
  }, [roles]);

  const filteredRoles = useMemo(() => {
    if (!search.trim()) return assignableRoles;
    const q = search.trim().toLowerCase();
    return assignableRoles.filter((r) => r.name.toLowerCase().includes(q));
  }, [assignableRoles, search]);

  const handleToggleRole = (roleId: string, currentChecked: boolean) => {
    setActionError(null);

    // Optimistically toggle immediately
    const nextChecked = !currentChecked;
    setOptimisticOverrides((prev) => ({ ...prev, [roleId]: nextChecked }));

    const promise = currentChecked
      ? removeRoleMember.mutateAsync({ roleId, userId: targetUserId })
      : addRoleMember.mutateAsync({ roleId, userId: targetUserId });

    promise
      .then(() => {
        onRoleToggled?.(roleId, nextChecked);
      })
      .catch((err: unknown) => {
        // Rollback on rejection and show error
        setOptimisticOverrides((prev) => {
          const next = { ...prev };
          delete next[roleId];
          return next;
        });
        const msg = err instanceof Error ? err.message : "Failed to update role";
        setActionError(msg);
      })
      .finally(() => {
        // Clear optimistic override once background mutation settles
        setOptimisticOverrides((prev) => {
          const next = { ...prev };
          delete next[roleId];
          return next;
        });
      });
  };

  return (
    <Popover.Root open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) {
        setSearch("");
        setActionError(null);
      }
    }}>
      <Popover.Trigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          onClick={(e) => e.stopPropagation()}
          className="z-50 w-64 rounded-lg border border-border bg-[#18191c] p-2 shadow-2xl animate-in fade-in-0 zoom-in-95"
        >
          {/* Search Header */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search roles"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded bg-[#111214] pl-8 pr-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary border border-border/40"
              autoFocus
            />
          </div>

          {actionError && (
            <div className="mb-2 px-2 py-1 bg-destructive/15 border border-destructive/30 rounded text-[11px] text-destructive flex items-center gap-1.5">
              <ShieldAlert className="size-3 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Roles List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5" role="menu">
            {filteredRoles.map((role) => {
              const isAssigned = effectiveAssignedIds.includes(role.id);
              const isDisabled = !canManage;

              return (
                <button
                  key={role.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isAssigned}
                  disabled={isDisabled}
                  onClick={() => handleToggleRole(role.id, isAssigned)}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors group cursor-pointer",
                    isAssigned
                      ? "bg-surface-hover/80 text-foreground"
                      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                    isDisabled && "opacity-50 cursor-not-allowed pointer-events-none"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: role.color || "#99aab5" }}
                    />
                    <span className="truncate font-medium text-left">
                      {role.name}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      isAssigned
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border/80 group-hover:border-muted-foreground"
                    )}
                  >
                    {isAssigned && <Check className="size-3 stroke-[2.5]" />}
                  </div>
                </button>
              );
            })}

            {filteredRoles.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No roles found
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
