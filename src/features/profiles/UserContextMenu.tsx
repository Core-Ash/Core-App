import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Copy, MessageSquare, UserRound, X } from "lucide-react";
import { UserProfilePopover } from "@/features/profiles/UserProfilePopover";
import { RelationshipActions } from "@/features/friends/RelationshipActions";
import { useOpenConversation } from "@/features/conversations/use-open-conversation";
import { useCurrentUser } from "@/features/community/api/hooks";
import { fullUsername } from "@/lib/display-name";
import type { PublicProfile } from "@/lib/api/types";

export interface UserContextMenuProps {
  profile: PublicProfile;
  conversationId?: string;
  onCloseConversation?: () => Promise<void>;
  children: ReactNode;
}

export function UserContextMenu({
  profile,
  conversationId,
  onCloseConversation,
  children,
}: UserContextMenuProps) {
  const trigger = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [closing, setClosing] = useState(false);

  // Avoid running queries or mutations when context menu is closed
  return (
    <>
      <UserProfilePopover
        profile={profile}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        anchorOnly
        returnFocus={trigger}
      >
        <div
          className="user-context-menu-trigger dm-user-menu-trigger"
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            trigger.current =
              event.target instanceof Element
                ? event.target.closest<HTMLElement>("a, button")
                : null;
            setNotice("");
            setPosition({ x: event.clientX, y: event.clientY });
          }}
          onKeyDown={(event) => {
            if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10"))
              return;
            event.preventDefault();
            event.stopPropagation();
            trigger.current = event.target as HTMLElement;
            const rect = event.currentTarget.getBoundingClientRect();
            setNotice("");
            setPosition({ x: rect.left + 20, y: rect.bottom });
          }}
        >
          {children}
        </div>
      </UserProfilePopover>

      {position &&
        createPortal(
          <UserContextMenuContent
            profile={profile}
            position={position}
            conversationId={conversationId}
            onCloseConversation={onCloseConversation}
            closing={closing}
            setClosing={setClosing}
            notice={notice}
            setNotice={setNotice}
            onDismiss={dismiss}
            onOpenProfile={() => {
              dismiss(false);
              setProfileOpen(true);
            }}
          />,
          document.body,
        )}
    </>
  );

  function dismiss(restoreFocus = true) {
    setPosition(null);
    if (restoreFocus) trigger.current?.focus();
  }
}

function UserContextMenuContent({
  profile,
  position,
  conversationId,
  onCloseConversation,
  closing,
  setClosing,
  notice,
  setNotice,
  onDismiss,
  onOpenProfile,
}: {
  profile: PublicProfile;
  position: { x: number; y: number };
  conversationId?: string;
  onCloseConversation?: () => Promise<void>;
  closing: boolean;
  setClosing: (closing: boolean) => void;
  notice: string;
  setNotice: (notice: string) => void;
  onDismiss: (restoreFocus?: boolean) => void;
  onOpenProfile: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const me = useCurrentUser();
  const openConversation = useOpenConversation();
  const isSelf = me.data?.id === profile.id;

  useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return;
    function place() {
      if (!element) return;
      const viewport = window.visualViewport;
      const left = (viewport?.offsetLeft ?? 0) + 8;
      const top = (viewport?.offsetTop ?? 0) + 8;
      element.style.left = `${Math.max(
        left,
        Math.min(
          position.x,
          left + (viewport?.width ?? window.innerWidth) - element.offsetWidth - 16,
        ),
      )}px`;
      element.style.top = `${Math.max(
        top,
        Math.min(
          position.y,
          top + (viewport?.height ?? window.innerHeight) - element.offsetHeight - 16,
        ),
      )}px`;
    }
    place();
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(place);
    observer?.observe(element);
    element.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    return () => observer?.disconnect();
  }, [position]);

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) onDismiss();
    }
    function close(event: Event) {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;
      onDismiss();
    }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [onDismiss]);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      onDismiss();
    } catch {
      setNotice("Couldn't copy. Please try again.");
    }
  }

  async function handleSendMessage() {
    try {
      onDismiss(false);
      await openConversation.openDirect(profile.id);
    } catch {
      setNotice("Couldn't start conversation. Please try again.");
    }
  }

  return (
    <div
      ref={menu}
      role="menu"
      aria-label={`User menu for ${profile.display_name}`}
      className="user-actions-menu dm-user-menu user-context-menu"
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
          onDismiss();
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled)',
          ),
        );
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
                items.length;
        items[next]?.focus();
      }}
    >
      <button role="menuitem" onClick={onOpenProfile}>
        <UserRound size={16} aria-hidden="true" />
        Profile
      </button>

      {onCloseConversation && (
        <button
          role="menuitem"
          disabled={closing}
          onClick={() => {
            setClosing(true);
            void onCloseConversation()
              .then(() => onDismiss())
              .catch(() =>
                setNotice("Couldn't close this conversation. Please try again."),
              )
              .finally(() => setClosing(false));
          }}
        >
          <X size={16} aria-hidden="true" />
          Close DM
        </button>
      )}

      {!onCloseConversation && !isSelf && (
        <button
          role="menuitem"
          disabled={openConversation.isPending}
          onClick={() => void handleSendMessage()}
        >
          <MessageSquare size={16} aria-hidden="true" />
          Message
        </button>
      )}

      {!isSelf && (
        <>
          <div role="separator" />
          <RelationshipActions
            profile={profile}
            menu
            onComplete={() => onDismiss()}
          />
        </>
      )}

      <div role="separator" />
      {fullUsername(profile) && (
        <button
          role="menuitem"
          onClick={() => void copy(fullUsername(profile))}
        >
          <Copy size={16} aria-hidden="true" />
          Copy Username
        </button>
      )}
      <button role="menuitem" onClick={() => void copy(profile.id)}>
        <Copy size={16} aria-hidden="true" />
        Copy User ID
      </button>
      {conversationId && (
        <button role="menuitem" onClick={() => void copy(conversationId)}>
          <Copy size={16} aria-hidden="true" />
          Copy Conversation ID
        </button>
      )}
      {notice && <p role="alert">{notice}</p>}
    </div>
  );
}

// Backward-compatible alias for existing imports
export const DmUserMenu = UserContextMenu;
