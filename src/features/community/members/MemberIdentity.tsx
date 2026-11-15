import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { UserAvatar } from "@/components/common/UserAvatar";
import type { MemberRole, PublicProfile } from "@/lib/api/types";

export function MemberIdentity({ profile, roles, joinedAt, avatar = true, username = true }: {
  profile: PublicProfile; roles?: MemberRole[]; joinedAt?: string; avatar?: boolean; username?: boolean;
}) {
  const user = { name: profile.display_name, email: profile.username, image: profile.avatar_url };
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="member-identity" title={profile.id} aria-label={`View profile for ${profile.display_name || profile.username}`}>
          {avatar && <UserAvatar user={user} className="size-9 shrink-0" />}
          <span className="min-w-0 text-left">
            <span className="block truncate font-medium">{profile.display_name || profile.username}</span>
            {username && <span className="block truncate text-xs text-muted-foreground">@{profile.username}</span>}
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="standard-dialog member-profile-dialog">
          <UserAvatar user={user} className="mb-3 size-16" />
          <Dialog.Title className="break-words text-xl font-semibold">{profile.display_name || profile.username}</Dialog.Title>
          <Dialog.Description className="break-all text-sm text-muted-foreground">@{profile.username}</Dialog.Description>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-muted-foreground">Member ID</dt><dd className="break-all">{profile.id}</dd></div>
            {joinedAt && <div><dt className="text-muted-foreground">Joined community</dt><dd><time dateTime={joinedAt}>{new Date(joinedAt).toLocaleDateString()}</time></dd></div>}
          </dl>
          {roles && <div className="mt-4"><h3 className="mb-2 text-sm font-semibold">Roles</h3>
            {roles.length ? <ul className="flex flex-wrap gap-2">{roles.map((role) => <li key={role.id} className="access-badge flex items-center gap-1">
              <span className="access-role-color" style={{ backgroundColor: role.color ?? "var(--muted-foreground)" }} aria-hidden="true" />{role.name}
            </li>)}</ul> : <p className="text-sm text-muted-foreground">No assigned roles.</p>}
          </div>}
          <Dialog.Close asChild><button className="icon-button dialog-close" aria-label="Close member profile"><X size={20} aria-hidden="true" /></button></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
