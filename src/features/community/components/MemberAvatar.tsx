import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { cn } from "@/lib/utils";
import type { CommunityMember } from "@/features/community/types";

export function MemberAvatar({
  member,
  small = false,
  presence = false,
  sample = true,
}: {
  member: CommunityMember;
  small?: boolean;
  presence?: boolean;
  sample?: boolean;
}) {
  const avatar = presence
    ? (member.activityAvatar ?? member.avatar)
    : member.avatar;
  return (
    <span className={cn("member-avatar", small && "member-avatar-small")}>
      <Avatar className={small ? "size-6 rounded-md" : "size-9 rounded-lg"}>
        {avatar && (
          <AvatarImage src={avatar} alt="" referrerPolicy="no-referrer" />
        )}
        <AvatarFallback
          className={cn(
            "sample-avatar",
            `avatar-${member.tone}`,
            small && "text-[9px]",
          )}
          aria-label={`${member.name}${sample ? " (sample member)" : ""}`}
        >
          {member.initials}
        </AvatarFallback>
      </Avatar>
      {presence && avatar ? (
        <span
          className="sr-only"
          role="img"
          aria-label={`${member.name}: ${member.status} (sample activity)`}
        />
      ) : (
        presence && (
          <StatusIndicator
            status={member.status}
            label={`${member.name}: ${member.status} (sample activity)`}
          />
        )
      )}
    </span>
  );
}
