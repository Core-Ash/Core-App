import { useEffect, useLayoutEffect, useRef } from "react";
import { Check, FolderPlus, Hash, UserPlus } from "lucide-react";
import type { ContextMenuPosition } from "./types";

export interface SidebarContextMenuProps {
  position: ContextMenuPosition;
  hideMutedChannels: boolean;
  canManage: boolean;
  onToggleHideMuted: () => void;
  onCreateChannel: () => void;
  onCreateCategory: () => void;
  onInvitePeople: () => void;
  onDismiss: () => void;
}

export function SidebarContextMenu({
  position,
  hideMutedChannels,
  canManage,
  onToggleHideMuted,
  onCreateChannel,
  onCreateCategory,
  onInvitePeople,
  onDismiss,
}: SidebarContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    function place() {
      if (!el) return;
      const viewport = window.visualViewport;
      const leftBound = (viewport?.offsetLeft ?? 0) + 8;
      const topBound = (viewport?.offsetTop ?? 0) + 8;
      const rightBound = leftBound + (viewport?.width ?? window.innerWidth) - el.offsetWidth - 16;
      const bottomBound = topBound + (viewport?.height ?? window.innerHeight) - el.offsetHeight - 16;

      el.style.left = `${Math.max(leftBound, Math.min(position.x, rightBound))}px`;
      el.style.top = `${Math.max(topBound, Math.min(position.y, bottomBound))}px`;
    }

    place();
    el.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled)')?.focus();
  }, [position]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onDismiss]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Server channel sidebar menu"
      className="fixed z-50 min-w-[220px] rounded-lg border border-border bg-popover p-1.5 shadow-2xl text-popover-foreground text-sm outline-none"
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const items = Array.from(
          e.currentTarget.querySelectorAll<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled)',
          ),
        );
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }}
    >
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={hideMutedChannels}
        className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-medium hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:outline-none transition-colors"
        onClick={() => {
          onToggleHideMuted();
          onDismiss();
        }}
      >
        <span>Hide Muted Channels</span>
        <div className="flex size-4 items-center justify-center rounded border border-muted-foreground/40 bg-background/50">
          {hideMutedChannels && <Check className="size-3 text-primary" />}
        </div>
      </button>

      <div role="separator" className="my-1 h-px bg-border" />

      {canManage && (
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:outline-none transition-colors"
          onClick={() => {
            onDismiss();
            onCreateChannel();
          }}
        >
          <Hash className="size-3.5 text-muted-foreground" />
          <span>Create Channel</span>
        </button>
      )}

      {canManage && (
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:outline-none transition-colors"
          onClick={() => {
            onDismiss();
            onCreateCategory();
          }}
        >
          <FolderPlus className="size-3.5 text-muted-foreground" />
          <span>Create Category</span>
        </button>
      )}

      {canManage && <div role="separator" className="my-1 h-px bg-border" />}

      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:outline-none transition-colors"
        onClick={() => {
          onDismiss();
          onInvitePeople();
        }}
      >
        <UserPlus className="size-3.5" />
        <span>Invite People</span>
      </button>
    </div>
  );
}
