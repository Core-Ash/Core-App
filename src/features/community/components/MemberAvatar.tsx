import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { CommunityMember } from "@/features/community/types";

export function MemberAvatar({
  member,
}: {
  member: CommunityMember;
}) {
  return (
    <span className="member-avatar">
      <Avatar className="size-9 rounded-lg">
        {member.avatar && (
          <AvatarImage src={member.avatar} alt="" referrerPolicy="no-referrer" />
        )}
        <AvatarFallback
          className={cn(
            "sample-avatar",
            `avatar-${member.tone}`,
          )}
          aria-label={member.name}
        >
          {member.initials}
        </AvatarFallback>
      </Avatar>
    </span>
  );
}
