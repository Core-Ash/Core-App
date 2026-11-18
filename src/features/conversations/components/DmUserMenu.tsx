import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, UserRound, X } from "lucide-react";
import { MemberProfileCard } from "@/features/community/members/MemberIdentity";
import { RelationshipActions } from "@/features/friends/RelationshipActions";
import { fullUsername } from "@/lib/display-name";
import type { PublicProfile } from "@/lib/api/types";

export function DmUserMenu({ profile, conversationId, onCloseConversation, children }: {
  profile: PublicProfile; conversationId: string; onCloseConversation: () => Promise<void>; children: ReactNode;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [closing, setClosing] = useState(false);

  function dismiss(restoreFocus = true) {
    setPosition(null);
    if (restoreFocus) trigger.current?.focus();
  }

  useLayoutEffect(() => {
    const element = menu.current;
    if (!position || !element) return;
    function place() {
      if (!element || !position) return;
      const viewport = window.visualViewport;
      const left = (viewport?.offsetLeft ?? 0) + 8;
      const top = (viewport?.offsetTop ?? 0) + 8;
      element.style.left = `${Math.max(left, Math.min(position.x, left + (viewport?.width ?? window.innerWidth) - element.offsetWidth - 16))}px`;
      element.style.top = `${Math.max(top, Math.min(position.y, top + (viewport?.height ?? window.innerHeight) - element.offsetHeight - 16))}px`;
    }
    place();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(place);
    observer?.observe(element);
    element.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    return () => observer?.disconnect();
  }, [position]);

  useEffect(() => {
    if (!position) return;
    function outside(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) setPosition(null);
    }
    function close(event: Event) {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;
      setPosition(null);
    }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [position]);

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); dismiss(); }
    catch { setNotice("Couldn't copy. Please try again."); }
  }

  return <Dialog.Root open={profileOpen} onOpenChange={setProfileOpen} modal={false}>
    <div ref={anchor} className="dm-user-menu-trigger" onContextMenu={(event) => {
      event.preventDefault(); event.stopPropagation();
      trigger.current = event.target instanceof Element ? event.target.closest<HTMLElement>("a, button") : null;
      setNotice(""); setPosition({ x: event.clientX, y: event.clientY });
    }} onKeyDown={(event) => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      event.preventDefault(); event.stopPropagation();
      trigger.current = event.target as HTMLElement;
      const rect = event.currentTarget.getBoundingClientRect();
      setNotice(""); setPosition({ x: rect.left + 20, y: rect.bottom });
    }}>{children}</div>
    {position && createPortal(<div ref={menu} role="menu" aria-label={`User menu for ${profile.display_name}`} className="dm-user-menu" onContextMenu={(event) => event.preventDefault()} onKeyDown={(event) => {
      if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); event.stopPropagation(); dismiss(); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }}>
      <button role="menuitem" onClick={() => { dismiss(false); setProfileOpen(true); }}><UserRound size={16} aria-hidden="true" />Profile</button>
      <button role="menuitem" disabled={closing} onClick={() => {
        setClosing(true);
        void onCloseConversation().then(() => dismiss()).catch(() => setNotice("Couldn't close this conversation. Please try again.")).finally(() => setClosing(false));
      }}><X size={16} aria-hidden="true" />Close DM</button>
      <div role="separator" />
      <RelationshipActions profile={profile} menu onComplete={() => dismiss()} />
      <div role="separator" />
      {fullUsername(profile) && <button role="menuitem" onClick={() => void copy(fullUsername(profile))}><Copy size={16} aria-hidden="true" />Copy Username</button>}
      <button role="menuitem" onClick={() => void copy(profile.id)}><Copy size={16} aria-hidden="true" />Copy User ID</button>
      <button role="menuitem" onClick={() => void copy(conversationId)}><Copy size={16} aria-hidden="true" />Copy Conversation ID</button>
      {notice && <p role="alert">{notice}</p>}
    </div>, document.body)}
    <Dialog.Portal><MemberProfileCard anchor={anchor} profile={profile} returnFocus={trigger} /></Dialog.Portal>
  </Dialog.Root>;
}
