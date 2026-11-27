import { useState, type MouseEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useInfiniteQuery } from "@tanstack/react-query";
import { SmilePlus, Users, X } from "lucide-react";
import { useAppData } from "@/app/app-data-context";
import { Button } from "@/components/ui/button";
import { FloatingEmojiPicker, type SelectedEmoji } from "@/components/ui/emoji-picker";
import { Tooltip } from "@/components/ui/tooltip";
import { MemberAvatar } from "@/features/community/components/MemberAvatar";
import { endpoints } from "@/lib/api/endpoints";
import type { MessageReactionGroup } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function formatReactionTooltip(group: MessageReactionGroup) {
  const names = group.users.slice(0, 3).map((u) => u.display_name);
  const remaining = Math.max(0, group.count - names.length);
  const label = group.emoji_name ? `:${group.emoji_name}:` : group.emoji;
  if (names.length === 0) {
    return `${label} · ${group.count} ${group.count === 1 ? "reaction" : "reactions"}`;
  }
  const summary =
    remaining > 0
      ? `${names.join(", ")}, and ${remaining} more`
      : names.join(", ");
  return `${label} reacted by ${summary}`;
}

export function ReactionUsersDialog({
  open,
  onClose,
  scopeKind,
  scopeId,
  messageId,
  reactions,
  initialEmoji,
}: {
  open: boolean;
  onClose: () => void;
  scopeKind: "channel" | "conversation";
  scopeId: string;
  messageId: string;
  reactions: readonly MessageReactionGroup[];
  initialEmoji?: string;
}) {
  const { api, ready } = useAppData();
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(initialEmoji);

  const usersQuery = useInfiniteQuery({
    queryKey: ["reaction-users", scopeKind, scopeId, messageId, selectedEmoji ?? "all"],
    queryFn: ({ pageParam, signal }) =>
      endpoints.reactionUsers(
        api,
        scopeKind,
        scopeId,
        messageId,
        { emoji: selectedEmoji, limit: 50, after_id: pageParam },
        signal,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: open && ready,
  });

  const entries = usersQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="standard-dialog reaction-users-dialog p-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
              <Users className="size-4 text-primary" />
              Reactions
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="icon-button" aria-label="Close reactions">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Users who reacted to this message.
          </Dialog.Description>

          <div className="reaction-filter-tabs flex flex-wrap gap-1.5 py-3 border-b border-border">
            <button
              type="button"
              className={cn(
                "reaction-filter-tab",
                selectedEmoji === undefined && "is-active",
              )}
              onClick={() => setSelectedEmoji(undefined)}
            >
              All ({reactions.reduce((acc, r) => acc + r.count, 0)})
            </button>
            {reactions.map((group) => (
              <button
                key={group.emoji}
                type="button"
                className={cn(
                  "reaction-filter-tab",
                  selectedEmoji === group.emoji && "is-active",
                )}
                onClick={() => setSelectedEmoji(group.emoji)}
              >
                {group.emoji_url ? (
                  <img src={group.emoji_url} alt={group.emoji_name ?? group.emoji} className="size-4 object-contain" />
                ) : (
                  <span>{group.emoji}</span>
                )}
                <span>{group.count}</span>
              </button>
            ))}
          </div>

          <div className="reaction-users-list max-h-72 overflow-y-auto py-2 space-y-1">
            {usersQuery.isPending ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading reactions…</p>
            ) : entries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No reactions found.</p>
            ) : (
              entries.map((entry) => (
                <div
                  key={`${entry.user.id}-${entry.emoji}`}
                  className="reaction-user-row flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent/50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MemberAvatar
                      member={{
                        id: entry.user.id,
                        name: entry.user.display_name,
                        initials: Array.from(entry.user.display_name)[0]?.toUpperCase() ?? "?",
                        tone: "slate",
                        avatar: entry.user.avatar_url ?? undefined,
                        profile: entry.user,
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {entry.user.display_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        @{entry.user.username}
                        {entry.user.discriminator ? `#${entry.user.discriminator}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-base pl-2">
                    {entry.emoji_url ? (
                      <img src={entry.emoji_url} alt={entry.emoji_name ?? entry.emoji} className="size-5 object-contain" />
                    ) : (
                      entry.emoji
                    )}
                  </div>
                </div>
              ))
            )}
            {usersQuery.hasNextPage && (
              <div className="pt-2 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={usersQuery.isFetchingNextPage}
                  onClick={() => void usersQuery.fetchNextPage()}
                >
                  {usersQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function MessageReactions({
  reactions,
  canAddNewReactions = true,
  communityId,
  scopeKind,
  scopeId,
  messageId,
  onToggleReaction,
}: {
  reactions: readonly MessageReactionGroup[];
  canAddNewReactions?: boolean;
  communityId?: string;
  scopeKind: "channel" | "conversation";
  scopeId: string;
  messageId: string;
  onToggleReaction: (emoji: SelectedEmoji, remove: boolean) => void;
}) {
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(null);
  const [usersModalEmoji, setUsersModalEmoji] = useState<string | null>(null);

  if (reactions.length === 0) return null;

  return (
    <div className="message-reactions" role="group" aria-label="Message reactions">
      {reactions.map((group) => {
        const label = group.emoji_name ? `:${group.emoji_name}:` : group.emoji;
        return (
          <Tooltip key={group.emoji} content={formatReactionTooltip(group)}>
            <button
              type="button"
              className={cn("message-reaction-pill", group.me && "is-me")}
              aria-pressed={group.me}
              aria-label={`React with ${label}, ${group.count} ${group.count === 1 ? "reaction" : "reactions"}`}
              onClick={() =>
                onToggleReaction(
                  {
                    value: group.emoji,
                    label: group.emoji_name ?? group.emoji,
                    customUrl: group.emoji_url ?? undefined,
                  },
                  group.me,
                )
              }
              onContextMenu={(event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                event.stopPropagation();
                setUsersModalEmoji(group.emoji);
              }}
            >
              {group.emoji_url ? (
                <img
                  src={group.emoji_url}
                  alt={label}
                  className="message-reaction-emoji-img"
                />
              ) : (
                <span className="message-reaction-emoji">{group.emoji}</span>
              )}
              <span className="message-reaction-count">{group.count}</span>
            </button>
          </Tooltip>
        );
      })}

      {canAddNewReactions && (
        <Tooltip content="Add Reaction">
          <button
            type="button"
            className="message-reaction-pill message-reaction-add"
            aria-label="Add another reaction"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setPickerPos({ x: rect.left, y: rect.bottom + 4 });
            }}
          >
            <SmilePlus className="size-3.5" aria-hidden="true" />
          </button>
        </Tooltip>
      )}

      <Tooltip content="View Reactions">
        <button
          type="button"
          className="message-reaction-view-users"
          aria-label="View who reacted"
          onClick={() => setUsersModalEmoji("")}
        >
          Who reacted
        </button>
      </Tooltip>

      <FloatingEmojiPicker
        open={Boolean(pickerPos)}
        position={pickerPos}
        communityId={communityId}
        onClose={() => setPickerPos(null)}
        onSelect={(emoji) => {
          const existing = reactions.find((r) => r.emoji === emoji.value);
          onToggleReaction(emoji, Boolean(existing?.me));
        }}
      />

      {usersModalEmoji !== null && (
        <ReactionUsersDialog
          open
          onClose={() => setUsersModalEmoji(null)}
          scopeKind={scopeKind}
          scopeId={scopeId}
          messageId={messageId}
          reactions={reactions}
          initialEmoji={usersModalEmoji || undefined}
        />
      )}
    </div>
  );
}
