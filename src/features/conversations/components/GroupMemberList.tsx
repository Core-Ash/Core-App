import { Crown, UserMinus } from "lucide-react";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import { useRemoveConversationMember } from "@/features/conversations/api";
import { apiErrorMessage } from "@/lib/api/errors";
import type { ConversationParticipant } from "@/lib/api/types";

interface GroupMemberListProps {
  conversationId: string;
  members: ConversationParticipant[];
  currentUserId: string;
  currentUserRole: "owner" | "member";
}

export function GroupMemberList({
  conversationId,
  members,
  currentUserId,
  currentUserRole,
}: GroupMemberListProps) {
  const isOwner = currentUserRole === "owner";
  const removeMember = useRemoveConversationMember(conversationId);

  function handleRemove(memberId: string, name: string) {
    if (removeMember.isPending || !window.confirm(`Remove ${name} from this group conversation?`)) return;
    removeMember.mutate(memberId);
  }

  // Sort: owner first, then alphabetically
  const sorted = [...members].sort((a, b) => {
    if (a.role === "owner") return -1;
    if (b.role === "owner") return 1;
    return a.profile.display_name.localeCompare(b.profile.display_name);
  });

  return (
    <div className="group-members-panel" aria-label="Group conversation members">
      <div className="group-members-header">
        <h3>Members — {members.length}</h3>
      </div>
      <ul className="group-members-list">
        {sorted.map((member) => {
          const isThisUser = member.profile.id === currentUserId;
          const isMemberOwner = member.role === "owner";

          return (
            <li key={member.id} className="group-member-item">
              <div className="group-member-info">
                <MemberIdentity profile={member.profile} />
                {isMemberOwner && (
                  <span className="group-owner-badge" title="Group Owner" aria-label="Group Owner">
                    <Crown size={12} aria-hidden="true" />
                  </span>
                )}
              </div>

              {isOwner && !isThisUser && (
                <div className="group-member-actions">
                  <button
                    type="button"
                    className="icon-button text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      void handleRemove(
                        member.profile.id,
                        member.profile.display_name,
                      )
                    }
                    disabled={removeMember.isPending}
                    title={`Remove ${member.profile.display_name}`}
                    aria-label={`Remove ${member.profile.display_name}`}
                  >
                    <UserMinus size={15} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {removeMember.error && <p role="alert" className="p-3 text-xs text-destructive">{apiErrorMessage(removeMember.error)}</p>}
    </div>
  );
}
