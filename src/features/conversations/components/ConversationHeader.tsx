import { useState } from "react";
import { Check, Edit2, LogOut, Search, UserPlus, Users, X } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import {
  useLeaveConversation,
  useUpdateConversation,
} from "@/features/conversations/api";
import { CreateGroupDmDialog } from "@/features/conversations/components/CreateGroupDmDialog";
import { apiErrorMessage } from "@/lib/api/errors";
import type { ConversationDetail } from "@/lib/api/types";

interface ConversationHeaderProps {
  conversation: ConversationDetail;
  currentUserId: string;
  membersVisible: boolean;
  onToggleMembers: () => void;
  search: string;
  onSearch: (value: string) => void;
}

export function ConversationHeader({
  conversation,
  currentUserId,
  membersVisible,
  onToggleMembers,
  search,
  onSearch,
}: ConversationHeaderProps) {
  const navigate = useNavigate();
  const [addFriendsOpen, setAddFriendsOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState(
    conversation.name ?? "",
  );
  const [renameError, setRenameError] = useState<string | null>(null);

  const updateConv = useUpdateConversation(conversation.id);
  const leaveConv = useLeaveConversation();

  const isDirect = conversation.type === "direct";
  const otherMember = isDirect
    ? conversation.members.find((m) => m.profile.id !== currentUserId) ??
      conversation.members[0]
    : null;

  const defaultGroupName = !isDirect
    ? conversation.name ||
      conversation.members
        .map((m) => m.profile.display_name)
        .slice(0, 3)
        .join(", ") + (conversation.members.length > 3 ? "…" : "")
    : "";

  async function handleRename() {
    const trimmed = groupNameInput.trim();
    if (!trimmed && !conversation.name) {
      setEditingName(false);
      return;
    }
    setRenameError(null);
    try {
      await updateConv.mutateAsync({ name: trimmed || undefined });
      setEditingName(false);
    } catch (err) {
      setRenameError(apiErrorMessage(err));
    }
  }

  function handleLeave() {
    if (leaveConv.isPending || !window.confirm("Are you sure you want to leave this group conversation?")) return;
    leaveConv.mutate(conversation.id, { onSuccess: () => navigate("/app/messages") });
  }

  return (
    <>
      <header className="chat-header conversation-header" aria-label="Conversation header">
        <div className="conversation-header-info">
          {isDirect && otherMember ? (
            <div className="conversation-header-user">
              <MemberIdentity profile={otherMember.profile} />
            </div>
          ) : (
            <div className="conversation-header-group">
              <div className="conversation-group-icon">
                <Users size={20} aria-hidden="true" />
              </div>
              {editingName ? (
                <div className="conversation-rename-box">
                  <input
                    type="text"
                    value={groupNameInput}
                    onChange={(e) => setGroupNameInput(e.target.value)}
                    maxLength={100}
                    placeholder={defaultGroupName}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleRename();
                      } else if (e.key === "Escape") {
                        setEditingName(false);
                        setGroupNameInput(conversation.name ?? "");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => void handleRename()}
                    title="Save group name"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      setEditingName(false);
                      setGroupNameInput(conversation.name ?? "");
                    }}
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                  {renameError && (
                    <span className="text-xs text-destructive">{renameError}</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="conversation-header-title">
                    {conversation.name || defaultGroupName}
                  </span>
                  <Tooltip content="Change Group Name">
                    <button
                      type="button"
                      className="icon-button text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setGroupNameInput(conversation.name ?? "");
                        setEditingName(true);
                      }}
                      aria-label="Edit group name"
                    >
                      <Edit2 size={13} />
                    </button>
                  </Tooltip>
                  <span className="conversation-member-count">
                    ({conversation.members.length})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="conversation-header-actions">
          {/* Add Friends button */}
          <Tooltip
            content={
              isDirect
                ? "Create Group DM with friend"
                : "Add friends to group"
            }
          >
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              aria-label={isDirect ? "Add Friends to DM" : "Add Members"}
              onClick={() => setAddFriendsOpen(true)}
            >
              <UserPlus size={16} aria-hidden="true" />
              <span className="hidden sm:inline">
                {isDirect ? "Add Friends to DM" : "Add Members"}
              </span>
            </Button>
          </Tooltip>

          {/* Toggle Members list for group DMs */}
          {!isDirect && (
            <Tooltip
              content={membersVisible ? "Hide Member List" : "Show Member List"}
            >
              <button
                type="button"
                className={`icon-button${membersVisible ? " is-active" : ""}`}
                onClick={onToggleMembers}
                aria-label="Toggle members list"
                aria-pressed={membersVisible}
              >
                <Users size={18} aria-hidden="true" />
              </button>
            </Tooltip>
          )}

          {/* Search messages */}
          <label className="conversation-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              aria-label="Search conversation messages"
            />
          </label>

          {/* Leave group */}
          {!isDirect && (
            <Tooltip content="Leave Group">
              <button
                type="button"
                className="icon-button text-destructive hover:bg-destructive/10"
                onClick={() => void handleLeave()}
                aria-label="Leave group conversation"
                disabled={leaveConv.isPending}
              >
                <LogOut size={17} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </div>
      </header>
      {leaveConv.error && <p role="alert" className="p-3 text-sm text-destructive">{apiErrorMessage(leaveConv.error)}</p>}

      {/* Add Friends Dialog */}
      <CreateGroupDmDialog
        open={addFriendsOpen}
        onOpenChange={setAddFriendsOpen}
        mode={isDirect ? "add_to_dm" : "add_members"}
        conversationId={conversation.id}
        existingMemberIds={
          isDirect && otherMember
            ? [otherMember.profile.id]
            : conversation.members.map((m) => m.profile.id)
        }
      />
    </>
  );
}
