import { useEffect, useId, useRef, useState, type ReactElement, type RefObject } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useInRouterContext, useLocation } from "react-router";
import { X } from "lucide-react";
import { UserAvatar } from "@/components/common/UserAvatar";
import { useOptionalAppData } from "@/app/app-data-context";
import { useCurrentUser, useMembers } from "@/features/community/api/hooks";
import { ConversationProfileName } from "@/features/conversations/components/ConversationProfileName";
import { CopyUsername } from "@/features/friends/CopyUsername";
import { RelationshipActions } from "@/features/friends/RelationshipActions";
import type { MemberRole, PublicProfile } from "@/lib/api/types";
import { displayName, fullUsername, publicUsername } from "@/lib/display-name";
import { useMediaQuery } from "@/lib/use-media-query";

const openedEvent = "core:user-profile-opened";
interface ProfileContext {
  profile: PublicProfile;
  communityId?: string;
  roles?: MemberRole[];
  joinedAt?: string;
}

// Every entry point owns an anchor; the event keeps one profile open across them.
export function UserProfilePopover({ children, open: controlledOpen, onOpenChange, anchorOnly = false, returnFocus, side = "left", ...context }: ProfileContext & {
  children: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  anchorOnly?: boolean;
  returnFocus?: RefObject<HTMLElement | null>;
  side?: "left" | "right";
}) {
  const id = useId();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const replaced = useRef(false);
  const routed = useInRouterContext();
  const narrow = useMediaQuery("(max-width: 767px)");
  const change = (value: boolean) => { setLocalOpen(value); onOpenChange?.(value); };
  useEffect(() => {
    if (!open) return;
    replaced.current = false;
    function replace(event: Event) {
      if ((event as CustomEvent<string>).detail === id) return;
      replaced.current = true;
      setLocalOpen(false);
      onOpenChange?.(false);
    }
    document.dispatchEvent(new CustomEvent(openedEvent, { detail: id }));
    document.addEventListener(openedEvent, replace);
    return () => document.removeEventListener(openedEvent, replace);
  }, [open, id, onOpenChange]);

  return <Popover.Root open={open} onOpenChange={change} modal={false}>
    {anchorOnly ? <Popover.Anchor asChild>{children}</Popover.Anchor> : <Popover.Trigger asChild onClick={(event) => event.stopPropagation()}>{children}</Popover.Trigger>}
    {open && routed && <CloseOnNavigation onClose={change} />}
    <Popover.Portal>
      <Popover.Content className="member-profile-dialog" side={narrow ? "bottom" : side} align="start" sideOffset={12} collisionPadding={12} sticky="always"
        aria-label={displayName(context.profile)} onClick={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => {
          if (replaced.current) event.preventDefault();
          else if (returnFocus) { event.preventDefault(); returnFocus.current?.focus(); }
        }}>
        <UserProfileCard {...context} />
        <Popover.Close asChild><button type="button" className="icon-button dialog-close member-profile-close" aria-label="Close member profile"><X size={16} aria-hidden="true" /></button></Popover.Close>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

function CloseOnNavigation({ onClose }: { onClose: (open: boolean) => void }) {
  const location = useLocation();
  const openedAt = useRef(location.key);
  // Strict Mode replays effect cleanup on mount. Dismiss only for an actual
  // navigation, never as a side effect of mounting or unmounting this watcher.
  useEffect(() => {
    if (location.key !== openedAt.current) onClose(false);
  }, [location.key, onClose]);
  return null;
}

function UserProfileCard({ profile, roles, joinedAt, communityId }: ProfileContext) {
  const data = useOptionalAppData();
  const routed = useInRouterContext();
  const name = displayName(profile);
  const handle = fullUsername(profile) || publicUsername(profile);
  return <>
    <div className="member-profile-banner" aria-hidden="true" />
    <UserAvatar user={{ name, email: "", image: profile.avatar_url }} className="member-profile-avatar" />
    <div className="member-profile-body">
      <h2 className="member-profile-name">{data?.ready && routed ? <ConversationProfileName id={profile.id} name={name} /> : name}</h2>
      {handle && <p className="member-profile-handle">{fullUsername(profile) || `@${handle}`}</p>}
      <div className="member-profile-actions">
        <CopyUsername profile={profile} />
        {data?.ready && <ProfileActions profile={profile} />}
      </div>
      {roles || joinedAt ? <CommunityDetails roles={roles} joinedAt={joinedAt} /> : communityId && data?.ready ? <LoadedCommunityDetails communityId={communityId} profile={profile} /> : null}
    </div>
  </>;
}

function ProfileActions({ profile }: { profile: PublicProfile }) {
  const me = useCurrentUser();
  if (!me.isSuccess || me.data.id === profile.id) return null;
  return <RelationshipActions profile={profile} />;
}

function LoadedCommunityDetails({ communityId, profile }: { communityId: string; profile: PublicProfile }) {
  // Fetch only while open; React Query scopes these results by community/search.
  const members = useMembers(communityId, undefined, profile.username);
  const member = !members.isError && members.data?.pages.flatMap((page) => page.items).find((item) => item.id === profile.id);
  return member ? <CommunityDetails roles={member.roles} joinedAt={member.joined_at} /> : null;
}

function CommunityDetails({ roles, joinedAt }: Pick<ProfileContext, "roles" | "joinedAt">) {
  return <>
    {!!roles?.length && <section className="member-profile-section" aria-label="Member roles">
      <h3>Roles</h3>
      <ul className="member-profile-roles">{roles.map((role) => <li key={role.id} className="member-profile-role">
        <span className="access-role-color" style={{ backgroundColor: role.color ?? "var(--muted-foreground)" }} aria-hidden="true" /><span>{role.name}</span>
      </li>)}</ul>
    </section>}
    {joinedAt && <dl className="member-profile-joined"><div><dt>Joined community</dt><dd><time dateTime={joinedAt}>{new Date(joinedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</time></dd></div></dl>}
  </>;
}
