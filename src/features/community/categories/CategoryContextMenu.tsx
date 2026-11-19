import { useEffect, useLayoutEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  FolderPlus,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { ChannelCategory } from "@/lib/api/types";
import type { ContextMenuPosition } from "./types";

export interface CategoryContextMenuProps {
  category: ChannelCategory;
  position: ContextMenuPosition;
  canManage: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onToggleMute: () => void;
  onCreateChannel: () => void;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onDismiss: () => void;
}

export function CategoryContextMenu({
  category,
  position,
  canManage,
  isCollapsed,
  onToggleCollapse,
  onToggleMute,
  onCreateChannel,
  onEditCategory,
  onDeleteCategory,
  onDismiss,
}: CategoryContextMenuProps) {
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
    el.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
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
      aria-label={`Category menu for ${category.name}`}
      className="fixed z-50 min-w-[200px] rounded-lg border border-border bg-popover p-1.5 shadow-2xl text-popover-foreground text-sm outline-none"
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const items = Array.from(
          e.currentTarget.querySelectorAll<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled)',
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
          <FolderPlus className="size-3.5 text-muted-foreground" />
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
            onEditCategory();
          }}
        >
          <Edit2 className="size-3.5 text-muted-foreground" />
          <span>Edit Category</span>
        </button>
      )}

      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:outline-none transition-colors"
        onClick={() => {
          onDismiss();
          onToggleCollapse();
        }}
      >
        {isCollapsed ? (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
        <span>{isCollapsed ? "Expand Category" : "Collapse Category"}</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:outline-none transition-colors"
        onClick={() => {
          onDismiss();
          onToggleMute();
        }}
      >
        {category.is_muted ? (
          <Volume2 className="size-3.5 text-muted-foreground" />
        ) : (
          <VolumeX className="size-3.5 text-muted-foreground" />
        )}
        <span>{category.is_muted ? "Unmute Category" : "Mute Category"}</span>
      </button>

      {canManage && (
        <>
          <div role="separator" className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:outline-none transition-colors"
            onClick={() => {
              onDismiss();
              onDeleteCategory();
            }}
          >
            <Trash2 className="size-3.5" />
            <span>Delete Category</span>
          </button>
        </>
      )}
    </div>
  );
}
