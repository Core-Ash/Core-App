import { useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, Search, Users, X } from "lucide-react";
import { useNavigate } from "react-router";
import { ModalContent } from "@/components/ui/modal-content";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/features/community/components/MemberAvatar";
import {
  useAddConversationMembers,
  useCreateGroupConversation,
} from "@/features/conversations/api";
import { useCurrentUser } from "@/features/community/api/hooks";
import { ApiNotice } from "@/components/common/ApiNotice";
import { useFriendList } from "@/features/friends/api";
import { apiErrorMessage } from "@/lib/api/errors";
import type { PublicProfile } from "@/lib/api/types";
import { fullUsername } from "@/lib/display-name";

interface CreateGroupDmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  mode?: "create" | "add_members" | "add_to_dm";
  conversationId?: string;
  existingMemberIds?: string[];
  initialSelectedIds?: string[];
}

export function CreateGroupDmDialog({
  open,
  onOpenChange,
  onCreated,
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

  const me = useCurrentUser();
  const searchInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const createGroup = useCreateGroupConversation();
  const addMembers = useAddConversationMembers(conversationId ?? "");

  const friends = useMemo(() => {
    const list = friendsQuery.data?.pages.flatMap((page) => page.items) ?? [];
    const unique = new Map<string, PublicProfile>();
    for (const item of list) {
      if (item.id !== me.data?.id) unique.set(item.id, item);
    }
    return Array.from(unique.values());
  }, [friendsQuery.data, me.data?.id]);

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

  const existingIds = [...new Set(existingMemberIds)].filter((id) => id !== me.data?.id);
  const maxAllowed = mode === "create" ? 8 : Math.max(0, 9 - existingIds.length);
  const selection = [...new Set(selectedIds)].filter((id) =>
    id !== me.data?.id && !existingIds.includes(id) && friends.some((friend) => friend.id === id),
  );
  const validSelection = me.isSuccess && selection.length > 0 && selection.length <= maxAllowed &&
    (mode !== "add_members" || Boolean(conversationId));

  function toggle(id: string) {
    if (submitting.current || id === me.data?.id || existingIds.includes(id)) return;
    setError(null);
    if (selection.includes(id)) setSelectedIds(selection.filter((item) => item !== id));
    else if (selection.length < maxAllowed) setSelectedIds([...selection, id]);
    else setError(`You can only add up to ${maxAllowed} friends.`);
  }

  const isSubmitting = createGroup.isPending || addMembers.isPending;

  async function handleSubmit() {
    if (!validSelection || submitting.current) return;
    submitting.current = true;
    setError(null);
    try {
      if (mode === "add_members") {
        await addMembers.mutateAsync(selection);
      } else {
        // A new group has its own ID and history; the original DM stays intact.
        const recipientIds = mode === "add_to_dm" ? [...new Set([...existingIds, ...selection])] : selection;
        const result = await createGroup.mutateAsync({ recipient_ids: recipientIds });
        navigate(`/app/messages/${result.id}`);
      }
      setSelectedIds([]); setSearch(""); onOpenChange(false); onCreated?.();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      submitting.current = false;
    }
  }

  const title = mode === "add_members" ? "Add Friends to Group" : "Create Group DM";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!submitting.current) {
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
        <ModalContent
          className="group-dm-dialog"
          onOpenAutoFocus={(event) => { event.preventDefault(); searchInput.current?.focus(); }}
          aria-describedby="group-dm-dialog-description"
        >
          <div className="group-dm-dialog-header">
            <div>
              <Dialog.Title className="group-dm-dialog-title">
                {title}
              </Dialog.Title>
              <Dialog.Description
                id="group-dm-dialog-description"
                className="group-dm-dialog-subtitle"
              >
                {maxAllowed > 0
                  ? `You can select up to ${maxAllowed} more friends.`
                  : "Group is full (maximum 10 participants)."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button"
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
              ref={searchInput}
              aria-label="Search friends"
              type="text"
              className="group-dm-search-input"
              placeholder="Search friends"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {friendsQuery.error && <ApiNotice error={friendsQuery.error} onRetry={() => void friendsQuery.refetch()} />}
          <div className="group-dm-friends-list" aria-label="Friends to select" aria-busy={isSubmitting}>
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
              const isExisting = existingIds.includes(friend.id);
              const isSelected = isExisting || selection.includes(friend.id);

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
            {friendsQuery.hasNextPage && <Button variant="ghost" disabled={friendsQuery.isFetchingNextPage || isSubmitting} onClick={() => void friendsQuery.fetchNextPage()}>Load more friends</Button>}
          </div>

          {error && (
            <p className="group-dm-error" role="alert">
              {error}
            </p>
          )}

          <div className="group-dm-footer">
            <span className="group-dm-counter">
              Selected: {selection.length}/{maxAllowed}
            </span>
            <Button
              type="button"
              disabled={!validSelection || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  <span>Processing…</span>
                </>
              ) : mode === "add_members" ? (
                "Add Members"
              ) : (
                "Create Group DM"
              )}
            </Button>
          </div>
        </ModalContent>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
