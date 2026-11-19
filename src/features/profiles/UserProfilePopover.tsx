import { useEffect, useId, useRef, useState, type ReactElement, type RefObject } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useInRouterContext, useLocation } from "react-router";
import { Plus, X } from "lucide-react";
import { UserAvatar } from "@/components/common/UserAvatar";
import { useOptionalAppData } from "@/app/app-data-context";
import { useCurrentUser, useMembers } from "@/features/community/api/hooks";
import { ConversationProfileName } from "@/features/conversations/components/ConversationProfileName";
import { CopyUsername } from "@/features/friends/CopyUsername";
import { RelationshipActions } from "@/features/friends/RelationshipActions";
import { useServerPermissions } from "@/features/community/server-settings/api";
import { MemberRoleSelector } from "@/features/community/server-settings/MemberRoleSelector";
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
      {roles || joinedAt ? (
        <CommunityDetails
          communityId={communityId}
          profile={profile}
          roles={roles}
          joinedAt={joinedAt}
        />
      ) : communityId && data?.ready ? (
        <LoadedCommunityDetails communityId={communityId} profile={profile} />
      ) : null}
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
  return member ? (
    <CommunityDetails
      communityId={communityId}
      profile={profile}
      roles={member.roles}
      joinedAt={member.joined_at}
    />
  ) : null;
}

function CommunityDetails({
  communityId,
  profile,
  roles,
  joinedAt,
}: Pick<ProfileContext, "communityId" | "profile" | "roles" | "joinedAt">) {
  const permsQuery = useServerPermissions(communityId);
  const canManage = Boolean(
    permsQuery.data?.owner ||
      permsQuery.data?.administrator ||
      permsQuery.data?.manage_roles
  );

  const visibleRoles = (roles ?? []).filter((r) => r.name !== "@everyone");
  const assignedRoleIds = visibleRoles.map((r) => r.id);

  return <>
    <section className="member-profile-section" aria-label="Member roles">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="m-0">Roles</h3>
      </div>
      <ul className="member-profile-roles flex flex-wrap items-center gap-1.5 list-none p-0 m-0">
        {visibleRoles.map((role) => (
          <li key={role.id} className="member-profile-role flex items-center gap-1.5">
            <span
              className="access-role-color size-2 rounded-full inline-block"
              style={{ backgroundColor: role.color ?? "var(--muted-foreground)" }}
              aria-hidden="true"
            />
            <span>{role.name}</span>
          </li>
        ))}
        {visibleRoles.length === 0 && !canManage && (
          <li className="text-xs text-muted-foreground list-none">No roles</li>
        )}
        {communityId && profile && canManage && (
          <li className="list-none inline-flex items-center">
            <MemberRoleSelector
              communityId={communityId}
              targetUserId={profile.id}
              targetUserName={profile.display_name}
              assignedRoleIds={assignedRoleIds}
              canManage={canManage}
              side="bottom"
              align="start"
              trigger={
                <button
                  type="button"
                  aria-label={`Assign roles to ${profile.display_name}`}
                  className="size-5 rounded bg-muted/50 hover:bg-muted border border-border/60 hover:border-border flex items-center justify-center text-muted-foreground hover:text-foreground text-xs transition-colors"
                  title="Assign roles"
                >
                  <Plus className="size-3" />
                </button>
              }
            />
          </li>
        )}
      </ul>
    </section>
    {joinedAt && <dl className="member-profile-joined"><div><dt>Joined community</dt><dd><time dateTime={joinedAt}>{new Date(joinedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</time></dd></div></dl>}
  </>;
}
