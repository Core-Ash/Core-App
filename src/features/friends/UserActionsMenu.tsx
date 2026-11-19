import { useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Ellipsis, UserRound } from "lucide-react";
import { UserProfilePopover } from "@/features/profiles/UserProfilePopover";
import { RelationshipActions } from "@/features/friends/RelationshipActions";
import { displayName, fullUsername } from "@/lib/display-name";
import type { PublicProfile } from "@/lib/api/types";

export function UserActionsMenu({ profile, open, onOpenChange }: {
  profile: PublicProfile; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const openingProfile = useRef(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const name = displayName(profile);
  return <UserProfilePopover profile={profile} open={profileOpen} onOpenChange={setProfileOpen} anchorOnly returnFocus={trigger}>
    <div className="friend-options">
      <DropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
        <DropdownMenu.Trigger asChild>
          <button ref={trigger} type="button" className="friend-options-trigger" aria-label={`More options for ${fullUsername(profile) || name}`} title="More options" onClick={(event) => event.stopPropagation()}>
            <Ellipsis size={20} aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="user-actions-menu" aria-label={`User actions for ${name}`} aria-labelledby={undefined} side="bottom" align="end" sideOffset={8} collisionPadding={12}
            onClick={(event) => event.stopPropagation()} onCloseAutoFocus={(event) => {
              if (openingProfile.current) { event.preventDefault(); openingProfile.current = false; }
            }}>
            <DropdownMenu.Item className="user-action-item" onSelect={() => {
              openingProfile.current = true;
              onOpenChange(false);
              setProfileOpen(true);
            }}><UserRound size={18} aria-hidden="true" />View Profile</DropdownMenu.Item>
            <RelationshipActions profile={profile} menu dropdown onComplete={() => onOpenChange(false)} />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  </UserProfilePopover>;
}
