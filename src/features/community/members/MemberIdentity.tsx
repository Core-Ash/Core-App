import { UserAvatar } from "@/components/common/UserAvatar";
import { UserProfilePopover } from "@/features/profiles/UserProfilePopover";
import type { MemberRole, PublicProfile } from "@/lib/api/types";
import { displayName, fullUsername, publicUsername } from "@/lib/display-name";

export function MemberIdentity({ profile, roles, joinedAt, communityId, avatar = true, username = true, label }: {
  profile: PublicProfile; roles?: MemberRole[]; joinedAt?: string; communityId?: string; avatar?: boolean; username?: boolean; label?: string;
}) {
  const name = displayName(profile);
  const handle = fullUsername(profile) || publicUsername(profile);
  return <UserProfilePopover profile={profile} roles={roles} joinedAt={joinedAt} communityId={communityId}>
    <button type="button" className="member-identity" title={name} aria-label={`View profile for ${name}`}>
      {avatar && <UserAvatar user={{ name, email: "", image: profile.avatar_url }} className="size-9 shrink-0" />}
      <span className="min-w-0 text-left">
        <span className="block truncate font-medium">{label ?? name}</span>
        {username && handle && <span className="block truncate text-xs text-muted-foreground">{fullUsername(profile) || `@${handle}`}</span>}
      </span>
    </button>
  </UserProfilePopover>;
}
