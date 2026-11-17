import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, Search, Users, X } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/features/community/components/MemberAvatar";
import {
  useAddConversationMembers,
  useCreateDirectConversation,
  useCreateGroupConversation,
} from "@/features/conversations/api";
import { useFriendList } from "@/features/friends/api";
import { apiErrorMessage } from "@/lib/api/errors";
import type { PublicProfile } from "@/lib/api/types";
import { fullUsername } from "@/lib/display-name";

interface CreateGroupDmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "add_members" | "add_to_dm";
  conversationId?: string;
  existingMemberIds?: string[];
  initialSelectedIds?: string[];
}

export function CreateGroupDmDialog({
  open,
  onOpenChange,
  mode = "create",
  conversationId,
  existingMemberIds = [],
  initialSelectedIds = [],
}: CreateGroupDmDialogProps) {
  const navigate = useNavigate();
  const friendsQuery = useFriendList("friends", open);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [error, setError] = useState<string | null>(null);

  const createDirect = useCreateDirectConversation();
  const createGroup = useCreateGroupConversation();
  const addMembers = useAddConversationMembers(conversationId ?? "");

  const friends = useMemo(() => {
    const list = friendsQuery.data?.pages.flatMap((page) => page.items) ?? [];
    const unique = new Map<string, PublicProfile>();
    for (const item of list) {
      unique.set(item.id, item);
    }
    return Array.from(unique.values());
  }, [friendsQuery.data]);

  const filteredFriends = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return friends;
    return friends.filter((f) => {
      const handle = fullUsername(f)?.toLowerCase() ?? "";
      return (
        f.display_name.toLowerCase().includes(term) ||
        f.username.toLowerCase().includes(term) ||
        handle.includes(term)
      );
    });
  }, [friends, search]);

  // Max selectable:
  // In "create" mode: up to 9 friends (total 10 with creator)
  // In "add_to_dm" mode: existingMemberIds has 1 friend, so up to 8 more (total 10)
  // In "add_members" mode: 10 - existingMemberIds.length
  const maxAllowed =
    mode === "add_members"
      ? Math.max(0, 10 - existingMemberIds.length)
      : mode === "add_to_dm"
        ? Math.max(0, 9 - existingMemberIds.length)
        : 9;

  function toggle(id: string) {
    if (existingMemberIds.includes(id)) return;
    setError(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= maxAllowed) {
        setError(`You can only add up to ${maxAllowed} friends.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  const isSubmitting =
    createDirect.isPending || createGroup.isPending || addMembers.isPending;

  async function handleSubmit() {
    if (selectedIds.length === 0 || isSubmitting) return;
    setError(null);

    try {
      if (mode === "create") {
        if (selectedIds.length === 1) {
          const result = await createDirect.mutateAsync({
            recipient_id: selectedIds[0],
          });
          onOpenChange(false);
          setSelectedIds([]);
          navigate(`/app/messages/${result.id}`);
        } else {
          const result = await createGroup.mutateAsync({
            recipient_ids: selectedIds,
          });
          onOpenChange(false);
          setSelectedIds([]);
          navigate(`/app/messages/${result.id}`);
        }
      } else if (mode === "add_to_dm") {
        // Creating a new Group DM with existing DM participant + new friends
        const allRecipientIds = Array.from(
          new Set([...existingMemberIds, ...selectedIds]),
        );
        const result = await createGroup.mutateAsync({
          recipient_ids: allRecipientIds,
        });
        onOpenChange(false);
        setSelectedIds([]);
        navigate(`/app/messages/${result.id}`);
      } else if (mode === "add_members") {
        if (!conversationId) return;
        await addMembers.mutateAsync(selectedIds);
        onOpenChange(false);
        setSelectedIds([]);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const title =
    mode === "add_members"
      ? "Add Friends to Group"
      : mode === "add_to_dm"
        ? "Create Group DM"
        : "Select Friends";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          if (!next) {
            setSelectedIds([]);
            setError(null);
            setSearch("");
          }
          onOpenChange(next);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content group-dm-dialog"
          aria-describedby="group-dm-dialog-description"
        >
          <div className="group-dm-dialog-header">
            <div>
              <Dialog.Title className="group-dm-dialog-title">
                {title}
              </Dialog.Title>
              <p
                id="group-dm-dialog-description"
                className="group-dm-dialog-subtitle"
              >
                {maxAllowed > 0
                  ? `You can select up to ${maxAllowed} more friends.`
                  : "Group is full (maximum 10 participants)."}
              </p>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button dialog-close"
                disabled={isSubmitting}
                aria-label="Close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="group-dm-search-wrap">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              className="group-dm-search-input"
              placeholder="Search friends"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="group-dm-friends-list">
            {friendsQuery.isPending && (
              <div className="group-dm-loading">
                <Loader2 className="animate-spin" size={20} />
                <span>Loading friends…</span>
              </div>
            )}

            {!friendsQuery.isPending && filteredFriends.length === 0 && (
              <div className="group-dm-empty">
                <Users size={32} aria-hidden="true" />
                <p>
                  {search.trim()
                    ? "No friends match your search."
                    : "No friends found. Add friends to start private conversations."}
                </p>
              </div>
            )}

            {filteredFriends.map((friend) => {
              const isExisting = existingMemberIds.includes(friend.id);
              const isSelected = isExisting || selectedIds.includes(friend.id);

              return (
                <button
                  type="button"
                  key={friend.id}
                  className={`group-dm-friend-row${isSelected ? " is-selected" : ""}${isExisting ? " is-disabled" : ""}`}
                  onClick={() => !isExisting && toggle(friend.id)}
                  disabled={isExisting || isSubmitting}
                  aria-pressed={isSelected}
                >
                  <div className="group-dm-friend-avatar">
                    <MemberAvatar
                      member={{
                        id: friend.id,
                        name: friend.display_name,
                        initials: friend.display_name.charAt(0).toUpperCase(),
                        tone: "slate",
                        avatar: friend.avatar_url ?? undefined,
                      }}
                    />
                  </div>
                  <div className="group-dm-friend-info">
                    <span className="group-dm-friend-name">
                      {friend.display_name}
                    </span>
                    <span className="group-dm-friend-tag">
                      {fullUsername(friend)}
                    </span>
                  </div>
                  <div
                    className={`group-dm-checkbox${isSelected ? " checked" : ""}`}
                    aria-hidden="true"
                  >
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>

          {error && (
            <p className="group-dm-error" role="alert">
              {error}
            </p>
          )}

          <div className="group-dm-footer">
            <span className="group-dm-counter">
              Selected: {selectedIds.length}/{maxAllowed}
            </span>
            <Button
              type="button"
              disabled={selectedIds.length === 0 || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  <span>Processing…</span>
                </>
              ) : mode === "create" && selectedIds.length === 1 ? (
                "Create DM"
              ) : mode === "add_members" ? (
                "Add Members"
              ) : (
                "Create Group DM"
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
