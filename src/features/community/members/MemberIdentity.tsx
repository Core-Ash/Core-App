import { useLayoutEffect, useRef, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { UserAvatar } from "@/components/common/UserAvatar";
import type { MemberRole, PublicProfile } from "@/lib/api/types";
import { displayName, publicUsername } from "@/lib/display-name";
import { fullUsername } from "@/lib/display-name";
import { CopyUsername } from "@/features/friends/CopyUsername";
import { RelationshipActions } from "@/features/friends/RelationshipActions";
import { useOptionalAppData } from "@/app/app-data-context";
import { useInRouterContext } from "react-router";
import { ConversationProfileName } from "@/features/conversations/components/ConversationProfileName";

export function MemberIdentity({ profile, roles, joinedAt, avatar = true, username = true, label }: {
  profile: PublicProfile; roles?: MemberRole[]; joinedAt?: string; avatar?: boolean; username?: boolean; label?: string;
}) {
  const name = displayName(profile);
  const handle = fullUsername(profile) || publicUsername(profile);
  const user = { name, email: "", image: profile.avatar_url };
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root modal={false}>
      <Dialog.Trigger asChild>
        <button ref={trigger} className="member-identity" title={name} aria-label={`View profile for ${name}`}>
          {avatar && <UserAvatar user={user} className="size-9 shrink-0" />}
          <span className="min-w-0 text-left">
            <span className="block truncate font-medium">{label ?? name}</span>
            {username && handle && <span className="block truncate text-xs text-muted-foreground">{fullUsername(profile) || `@${handle}`}</span>}
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <MemberProfileCard anchor={trigger} profile={profile} roles={roles} joinedAt={joinedAt} />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function MemberProfileCard({ anchor, profile, roles, joinedAt, returnFocus }: {
  anchor: RefObject<HTMLElement | null>; profile: PublicProfile; roles?: MemberRole[]; joinedAt?: string; returnFocus?: RefObject<HTMLElement | null>;
}) {
  const content = useRef<HTMLDivElement>(null);
  const name = displayName(profile);
  const handle = fullUsername(profile) || publicUsername(profile);
  const data = useOptionalAppData();
  const inRouter = useInRouterContext();

  useLayoutEffect(() => {
    const card = content.current;
    const trigger = anchor.current;
    if (!card || !trigger) return;
    function position() {
      if (!card || !trigger) return;
      const viewport = window.visualViewport;
      const minLeft = (viewport?.offsetLeft ?? 0) + 12;
      const minTop = (viewport?.offsetTop ?? 0) + 12;
      const right = minLeft + (viewport?.width ?? window.innerWidth) - 24;
      const bottom = minTop + (viewport?.height ?? window.innerHeight) - 24;
      card.style.maxHeight = `${bottom - minTop}px`;
      card.style.maxWidth = `${right - minLeft}px`;
      const target = trigger.getBoundingClientRect();
      const { width, height } = card.getBoundingClientRect();
      // Prefer the left of the member list; flip when the trigger is near the left edge.
      const preferredLeft = target.left - width - 12;
      const left = preferredLeft >= minLeft ? preferredLeft : target.right + 12;
      card.style.left = `${Math.max(minLeft, Math.min(left, right - width))}px`;
      card.style.top = `${Math.max(minTop, Math.min(target.top, bottom - height))}px`;
      card.style.visibility = "visible";
    }
    position();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(position);
    observer?.observe(card);
    observer?.observe(trigger);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [anchor]);

  return (
    <Dialog.Content ref={content} className="member-profile-dialog" onCloseAutoFocus={(event) => {
      if (returnFocus) { event.preventDefault(); returnFocus.current?.focus(); }
    }}>
      <div className="member-profile-banner" aria-hidden="true" />
      <UserAvatar user={{ name, email: "", image: profile.avatar_url }} className="member-profile-avatar" />
      <div className="member-profile-body">
        <Dialog.Title className="member-profile-name">{data?.ready && inRouter ? <ConversationProfileName id={profile.id} name={name} /> : name}</Dialog.Title>
        <Dialog.Description className={handle ? "member-profile-handle" : "sr-only"}>
          {handle ? (fullUsername(profile) || `@${handle}`) : "Core member profile"}
        </Dialog.Description>
        <CopyUsername profile={profile} />
        {data?.ready && fullUsername(profile) && <RelationshipActions profile={profile} />}
        {roles && <section className="member-profile-section" aria-label="Member roles">
          <h3>Roles</h3>
          {roles.length ? <ul className="member-profile-roles">{roles.map((role) => <li key={role.id} className="member-profile-role">
            <span className="access-role-color" style={{ backgroundColor: role.color ?? "var(--muted-foreground)" }} aria-hidden="true" />
            <span>{role.name}</span>
          </li>)}</ul> : <p className="member-profile-empty">No assigned roles</p>}
        </section>}
        {joinedAt && <dl className="member-profile-joined">
          <div><dt>Joined community</dt><dd><time dateTime={joinedAt}>{new Date(joinedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</time></dd></div>
        </dl>}
      </div>
      <Dialog.Close asChild>
        <button className="icon-button dialog-close member-profile-close" aria-label="Close member profile"><X size={16} aria-hidden="true" /></button>
      </Dialog.Close>
    </Dialog.Content>
  );
}
