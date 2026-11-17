import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CalendarPlus, ChevronDown, Copy, PlusCircle, Settings, UserRoundPlus } from "lucide-react";
import { useNavigate } from "react-router";
import { CreateChannelDialog } from "@/features/community/components/CreateResourceDialog";
import { InviteDialog } from "@/features/invites/InviteDialog";
import { useInvitePermissions } from "@/features/invites/api";
import { EventDialog } from "@/features/events/EventDialog";
import { useEventPermissions } from "@/features/events/api";
import { communityHref } from "@/features/community/api/use-community-selection";
import type { Community } from "@/lib/api/types";

export function ServerDropdown({ community, canCreateChannel, onNavigate }: {
  community?: Community; canCreateChannel: boolean; onNavigate?: () => void;
}) {
  const id = useId(), navigate = useNavigate();
  const invites = useInvitePermissions(community?.id ?? "");
  const events = useEventPermissions(community?.id ?? "");
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"invite" | "channel" | "event" | null>(null);
  const [feedback, setFeedback] = useState("");
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<"first" | "last">("first");
  useLayoutEffect(() => {
    if (!open) return;
    const items = menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items?.[initialFocus.current === "last" ? items.length - 1 : 0]?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const blur = (event: FocusEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss); document.addEventListener("focusin", blur);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("focusin", blur); };
  }, [open]);
  useEffect(() => { if (!feedback) return; const timer = window.setTimeout(() => setFeedback(""), 5000); return () => window.clearTimeout(timer); }, [feedback]);
  function close() { setOpen(false); trigger.current?.focus(); }
  function launch(value: "invite" | "channel" | "event") { close(); setDialog(value); }
  return <div className="community-picker" ref={root}>
    <button type="button" className="server-header-trigger" ref={trigger} disabled={!community}
      aria-label={`Server menu, ${community?.name ?? "Core"}`} aria-haspopup="menu" aria-expanded={open} aria-controls={id}
      onClick={() => { initialFocus.current = "first"; setOpen(!open); }}
      onKeyDown={(event) => {
        if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); initialFocus.current = event.key === "ArrowUp" ? "last" : "first"; setOpen(true); }
        if (event.key === "Escape") close();
      }}>
      <span className="community-banner-art" aria-hidden="true" /><strong>{community?.name ?? "Core"}</strong><ChevronDown size={18} aria-hidden="true" />
    </button>
    <div id={id} ref={menu} className="community-picker-menu" role="menu" aria-label="Server actions" hidden={!open}
      onKeyDown={(event) => {
        const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items[next]?.focus();
        } else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
        else if (event.key === "Tab") close();
        else if (event.key.length === 1 && /\S/.test(event.key)) {
          const next = [...items.slice(index + 1), ...items.slice(0, index + 1)].find((item) => item.textContent?.toLowerCase().startsWith(event.key.toLowerCase()));
          if (next) { event.preventDefault(); next.focus(); }
        }
      }}>
      {community && <>
        {invites.isSuccess && invites.data.create && <button role="menuitem" tabIndex={-1} className="server-menu-action server-menu-invite" onClick={() => launch("invite")}><UserRoundPlus aria-hidden="true" /><span>Invite People</span></button>}
        <button role="menuitem" tabIndex={-1} className="server-menu-action" onClick={() => { close(); navigate(communityHref(community.id, undefined, "overview")); onNavigate?.(); }}><Settings aria-hidden="true" /><span>Server Settings</span></button>
        {canCreateChannel && <button role="menuitem" tabIndex={-1} className="server-menu-action" onClick={() => launch("channel")}><PlusCircle aria-hidden="true" /><span>Create Channel</span></button>}
        {events.isSuccess && events.data.create && <button role="menuitem" tabIndex={-1} className="server-menu-action" onClick={() => launch("event")}><CalendarPlus aria-hidden="true" /><span>Create Event</span></button>}
        <div role="separator" className="server-menu-separator" />
        <button role="menuitem" tabIndex={-1} className="server-menu-action" onClick={() => {
          close();
          void (async () => {
            try { await navigator.clipboard.writeText(community.id); setFeedback("Server ID copied"); }
            catch { setFeedback("Couldn't copy server ID. Check clipboard permissions and try again."); }
          })();
        }}><Copy aria-hidden="true" /><span>Copy Server ID</span></button>
      </>}
    </div>
    {community && <>
      <InviteDialog community={community} open={dialog === "invite"} onOpenChange={(value) => { if (!value) setDialog(null); }} returnFocusRef={trigger} />
      <CreateChannelDialog communityId={community.id} open={dialog === "channel"} onOpenChange={(value) => { if (!value) setDialog(null); }} returnFocusRef={trigger} />
      <EventDialog community={community} open={dialog === "event"} onOpenChange={(value) => { if (!value) setDialog(null); }} returnFocusRef={trigger} />
    </>}
    <div role="status" aria-live="polite" className={feedback ? "server-menu-feedback" : "sr-only"}>{feedback}</div>
  </div>;
}
