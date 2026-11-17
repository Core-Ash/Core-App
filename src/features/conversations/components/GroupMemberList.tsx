import { Crown, UserMinus } from "lucide-react";
import { MemberAvatar } from "@/features/community/components/MemberAvatar";
import { useRemoveConversationMember } from "@/features/conversations/api";
import { apiErrorMessage } from "@/lib/api/errors";
import type { ConversationParticipant } from "@/lib/api/types";
import { fullUsername } from "@/lib/display-name";

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

  async function handleRemove(memberId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this group conversation?`)) return;
    try {
      await removeMember.mutateAsync(memberId);
    } catch (err) {
      alert(apiErrorMessage(err));
    }
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
                <MemberAvatar
                  member={{
                    id: member.profile.id,
                    name: member.profile.display_name,
                    initials: member.profile.display_name.charAt(0).toUpperCase(),
                    tone: "slate",
                    avatar: member.profile.avatar_url ?? undefined,
                  }}
                />
                <div className="group-member-names">
                  <div className="flex items-center gap-1.5">
                    <span className="group-member-display-name">
                      {member.profile.display_name}
                    </span>
                    {isMemberOwner && (
                      <span
                        className="group-owner-badge"
                        title="Group Owner"
                        aria-label="Group Owner"
                      >
                        <Crown size={12} aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <span className="group-member-username">
                    {fullUsername(member.profile)}
                  </span>
                </div>
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
    </div>
  );
}
