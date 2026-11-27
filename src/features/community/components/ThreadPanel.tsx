import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Check,
  Lock,
  LockOpen,
  MessagesSquare,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAppData } from "@/app/app-data-context";
import { ApiNotice } from "@/components/common/ApiNotice";
import { ChatMessageSkeleton } from "@/components/common/skeleton/Skeletons";
import { Button } from "@/components/ui/button";
import {
  queryKeys,
  useMembers,
  useSendThreadMessage,
  useThread,
  useThreadMessages,
  useToggleReaction,
} from "@/features/community/api/hooks";
import { MessageList } from "@/features/community/components/MessageList";
import type { ChatMessageData } from "@/features/community/types";
import { ChannelMentionComposer } from "@/features/mentions/MentionComposers";
import { plainMessageText } from "@/features/mentions/model";
import { displayName } from "@/lib/display-name";
import { endpoints } from "@/lib/api/endpoints";
import { apiErrorMessage } from "@/lib/api/errors";
import type { MessageReplyReference, ThreadDetail, ThreadSummary } from "@/lib/api/types";

export function ThreadIndicator({
  thread,
  onOpenThread,
}: {
  thread: ThreadSummary;
  onOpenThread: (threadId: string) => void;
}) {
  const replyCount = thread.message_count;
  const replyLabel = `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`;

  return (
    <button
      type="button"
      className="message-thread-indicator"
      aria-label={`Open thread ${thread.name}, ${replyLabel}`}
      onClick={() => onOpenThread(thread.id)}
    >
      <MessagesSquare className="size-3.5 text-primary shrink-0" aria-hidden="true" />
      <span className="message-thread-indicator-name">{thread.name}</span>
      <span className="message-thread-indicator-count">{replyLabel}</span>
      <span className="message-thread-indicator-link">View Thread ›</span>
    </button>
  );
}

export function CreateThreadDialog({
  open,
  onClose,
  channelId,
  communityId,
  starterMessage,
  canCreatePublic = true,
  canCreatePrivate = true,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  channelId: string;
  communityId: string;
  starterMessage: ChatMessageData;
  canCreatePublic?: boolean;
  canCreatePrivate?: boolean;
  onCreated: (thread: ThreadDetail) => void;
}) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  const defaultTitle = useMemo(() => {
    const text = plainMessageText(starterMessage.body, starterMessage.mentions).trim();
    return text ? text.slice(0, 48) : `${starterMessage.author.name}'s Thread`;
  }, [starterMessage]);

  const [name, setName] = useState(defaultTitle);
  const [threadType, setThreadType] = useState<"public" | "private">(
    canCreatePublic ? "public" : "private",
  );
  const [initialMessage, setInitialMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const created = await endpoints.createThread(api, channelId, {
        name: name.trim(),
        starter_message_id: starterMessage.id,
        thread_type: threadType,
        ...(initialMessage.trim()
          ? {
              initial_message: initialMessage.trim(),
              client_nonce: crypto.randomUUID(),
            }
          : {}),
      });
      queries.setQueryData(queryKeys.thread(created.id), created);
      void queries.invalidateQueries({ queryKey: queryKeys.messages(channelId) });
      void queries.invalidateQueries({ queryKey: queryKeys.channelThreads(channelId) });
      onCreated(created);
      onClose();
    } catch (failure) {
      setError(apiErrorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="standard-dialog create-thread-dialog p-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
              <MessagesSquare className="size-4 text-primary" />
              Create Thread
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button"
                disabled={busy}
                aria-label="Close create thread dialog"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Start a discussion thread from this message. Note: server ID {communityId}.
          </Dialog.Description>

          <div className="my-3 p-3 rounded-md bg-secondary/70 border border-border text-xs">
            <div className="text-muted-foreground mb-1">Starting message:</div>
            <div className="font-semibold text-foreground">
              {starterMessage.author.name}:{" "}
              <span className="font-normal text-muted-foreground">
                {plainMessageText(starterMessage.body, starterMessage.mentions).slice(0, 120)}
              </span>
            </div>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="thread-name-input" className="text-xs font-semibold text-muted-foreground uppercase">
                Thread Name
              </label>
              <input
                id="thread-name-input"
                type="text"
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm outline-none"
                placeholder="New thread name"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Visibility
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!canCreatePublic}
                  aria-pressed={threadType === "public"}
                  className={`p-2.5 rounded-md border text-left text-xs transition-colors ${
                    threadType === "public"
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                  onClick={() => setThreadType("public")}
                >
                  <div className="font-semibold text-foreground">Public Thread</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Anyone who can view this channel can view and join.
                  </div>
                </button>
                <button
                  type="button"
                  disabled={!canCreatePrivate}
                  aria-pressed={threadType === "private"}
                  className={`p-2.5 rounded-md border text-left text-xs transition-colors ${
                    threadType === "private"
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                  onClick={() => setThreadType("private")}
                >
                  <div className="font-semibold text-foreground flex items-center gap-1">
                    <Lock className="size-3" /> Private Thread
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Only invited members and moderators can view.
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="thread-initial-msg" className="text-xs font-semibold text-muted-foreground uppercase">
                Initial Message (Optional)
              </label>
              <textarea
                id="thread-initial-msg"
                rows={2}
                maxLength={4000}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm outline-none resize-none"
                placeholder="Kick off the thread discussion…"
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || busy}>
                {busy ? "Creating…" : "Create Thread"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ThreadPanel({
  threadId,
  communityId,
  parentChannelId,
  currentUserId,
  currentUserRoleIds,
  onClose,
  onForwardMessage,
}: {
  threadId: string;
  communityId: string;
  parentChannelId: string;
  currentUserId?: string;
  currentUserRoleIds?: ReadonlySet<string> | readonly string[];
  onClose: () => void;
  onForwardMessage?: (message: ChatMessageData) => void;
}) {
  const { api } = useAppData();
  const queries = useQueryClient();
  const threadQuery = useThread(threadId);
  const history = useThreadMessages(threadId);
  const send = useSendThreadMessage(threadId, parentChannelId);
  const toggleReaction = useToggleReaction(
    "channel",
    parentChannelId,
    queryKeys.threadMessages(threadId),
  );
  const channelMembers = useMembers(communityId, parentChannelId, "", true);

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [showParticipants, setShowParticipants] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageReplyReference | null>(null);
  const [replyMention, setReplyMention] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const thread = threadQuery.data;

  const updateMutation = useMutation({
    mutationFn: (input: { name?: string; archived?: boolean; locked?: boolean }) =>
      endpoints.updateThread(api, threadId, input),
    onSuccess: (updated) => {
      queries.setQueryData(queryKeys.thread(threadId), updated);
      void queries.invalidateQueries({ queryKey: queryKeys.messages(parentChannelId) });
      void queries.invalidateQueries({ queryKey: queryKeys.channelThreads(parentChannelId) });
      setRenaming(false);
      setActionError(null);
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const membershipMutation = useMutation({
    mutationFn: (action: { type: "join" | "leave"; userId?: string }) =>
      action.type === "join"
        ? endpoints.joinThread(api, threadId, action.userId)
        : endpoints.leaveThread(api, threadId),
    onSuccess: (updated) => {
      queries.setQueryData(queryKeys.thread(threadId), updated);
      setActionError(null);
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => endpoints.deleteThread(api, threadId),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: queryKeys.messages(parentChannelId) });
      void queries.invalidateQueries({ queryKey: queryKeys.channelThreads(parentChannelId) });
      onClose();
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const messages = useMemo<ChatMessageData[]>(() => {
    const unique = new Map(
      history.data?.pages.flatMap((page) => page.items).map((item) => [item.id, item]),
    );
    const local = new Map(
      send.entries.map((entry) => [
        entry.message.author_id + ":" + entry.message.client_nonce,
        entry,
      ]),
    );
    for (const item of unique.values()) {
      local.delete(item.author_id + ":" + item.client_nonce);
    }
    const server = [...unique.values()].sort(
      (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id),
    );
    return [...server, ...[...local.values()].map((e) => e.message)]
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      .map((item) => {
        const name = displayName(item.author);
        const key = item.author_id + ":" + item.client_nonce;
        return {
          id: item.id,
          renderKey: key,
          delivery: local.get(key)?.status,
          deliveryError: local.get(key)?.error,
          onRetry: local.get(key)?.retryable ? () => send.retry(item.client_nonce) : undefined,
          body: item.body ?? "",
          mentions: item.mentions,
          createdAt: item.created_at,
          edited: Boolean(item.edited_at),
          deleted: Boolean(item.deleted_at) || (item.body === null && !item.forwarded && !item.attachments?.length),
          attachments: item.attachments,
          reactions: item.reactions,
          replyToMessageId: item.reply_to_message_id,
          replyMention: item.reply_mention,
          replyTo: item.reply_to,
          forwarded: item.forwarded,
          threadId: item.thread_id,
          author: {
            id: item.author_id,
            name,
            initials: Array.from(name)[0]?.toUpperCase() ?? "?",
            tone: "slate",
            avatar: item.author?.avatar_url ?? undefined,
            profile: item.author,
          },
        };
      });
  }, [history.data, send]);

  if (threadQuery.isPending) {
    return (
      <aside className="thread-panel" aria-label="Thread discussion">
        <div className="p-4 text-sm text-muted-foreground">Loading thread…</div>
      </aside>
    );
  }

  if (threadQuery.error || !thread) {
    return (
      <aside className="thread-panel" aria-label="Thread discussion">
        <header className="thread-panel-header">
          <span className="font-semibold text-sm">Thread Unavailable</span>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close thread">
            <X className="size-4" />
          </button>
        </header>
        <div className="p-4">
          <ApiNotice error={threadQuery.error} onRetry={() => void threadQuery.refetch()} />
        </div>
      </aside>
    );
  }

  const starterMsg = thread.starter_message;
  const invitableMembers = (channelMembers.data?.pages.flatMap((p) => p.items) ?? []).filter(
    (m) => !thread.participants.some((p) => p.id === m.id),
  );

  return (
    <aside className="thread-panel" aria-label={`Thread: ${thread.name}`}>
      <header className="thread-panel-header">
        <div className="thread-panel-title-area min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {thread.thread_type === "private" ? (
              <Lock className="size-4 text-primary shrink-0" aria-hidden="true" />
            ) : (
              <MessagesSquare className="size-4 text-primary shrink-0" aria-hidden="true" />
            )}
            {renaming ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input
                  type="text"
                  className="px-2 py-0.5 text-sm rounded border border-border bg-background w-full"
                  aria-label="Thread name"
                  value={nameDraft}
                  maxLength={100}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nameDraft.trim()) {
                      updateMutation.mutate({ name: nameDraft.trim() });
                    } else if (e.key === "Escape") {
                      setRenaming(false);
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="icon-button size-6"
                  aria-label="Save thread name"
                  onClick={() => {
                    if (nameDraft.trim()) updateMutation.mutate({ name: nameDraft.trim() });
                  }}
                >
                  <Check className="size-3.5" />
                </button>
              </div>
            ) : (
              <h2 className="font-semibold text-sm truncate" title={thread.name}>
                Thread: {thread.name}
              </h2>
            )}
            {thread.archived && (
              <span className="thread-badge">Archived</span>
            )}
            {thread.locked && (
              <span className="thread-badge thread-badge-locked">Locked</span>
            )}
          </div>
        </div>

        <div className="thread-panel-controls flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="icon-button size-7"
            aria-label="Thread participants"
            title="Participants"
            onClick={() => setShowParticipants((v) => !v)}
          >
            <Users className="size-4" />
          </button>
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-border hover:bg-accent"
            onClick={() =>
              membershipMutation.mutate({ type: thread.is_joined ? "leave" : "join" })
            }
          >
            {thread.is_joined ? "Leave" : "Join"}
          </button>
          {thread.can_manage && !renaming && (
            <button
              type="button"
              className="icon-button size-7"
              aria-label="Rename thread"
              title="Rename thread"
              onClick={() => {
                setNameDraft(thread.name);
                setRenaming(true);
              }}
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          {(thread.can_manage || (thread.archived && !thread.locked && thread.can_send)) && (
            <button
              type="button"
              className="icon-button size-7"
              aria-label={thread.archived ? "Unarchive thread" : "Archive thread"}
              title={thread.archived ? "Unarchive thread" : "Archive thread"}
              onClick={() => updateMutation.mutate({ archived: !thread.archived })}
            >
              {thread.archived ? (
                <ArchiveRestore className="size-3.5" />
              ) : (
                <Archive className="size-3.5" />
              )}
            </button>
          )}
          {thread.can_lock && (
            <button
              type="button"
              className="icon-button size-7"
              aria-label={thread.locked ? "Unlock thread" : "Lock thread"}
              title={thread.locked ? "Unlock thread" : "Lock thread"}
              onClick={() => updateMutation.mutate({ locked: !thread.locked })}
            >
              {thread.locked ? (
                <LockOpen className="size-3.5" />
              ) : (
                <Lock className="size-3.5" />
              )}
            </button>
          )}
          {thread.can_delete && (
            <button
              type="button"
              className="icon-button size-7 text-destructive"
              aria-label="Delete thread"
              title="Delete thread"
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            className="icon-button size-7"
            aria-label="Close thread"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {actionError && (
        <p role="alert" className="px-3 py-1.5 text-xs text-destructive bg-destructive/10">
          {actionError}
        </p>
      )}

      {showParticipants && (
        <div
          className="thread-participants-drawer p-3 border-b border-border bg-secondary/40 text-xs space-y-2"
          role="region"
          aria-label="Thread participants list"
        >
          <div className="font-semibold text-foreground">
            Participants ({thread.participants.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {thread.participants.map((p) => (
              <span
                key={p.id}
                className="px-2 py-0.5 rounded-full bg-card border border-border text-foreground"
              >
                {p.display_name}
              </span>
            ))}
          </div>
          {thread.thread_type === "private" && invitableMembers.length > 0 && (
            <div className="pt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-muted-foreground flex items-center gap-1">
                <UserPlus className="size-3" /> Add member:
              </span>
              {invitableMembers.slice(0, 5).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-foreground"
                  onClick={() =>
                    membershipMutation.mutate({ type: "join", userId: m.id })
                  }
                >
                  + {m.nickname || m.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Starter message header reference */}
      <div className="thread-starter-card px-3 py-2.5 border-b border-border bg-secondary/30 text-xs">
        {starterMsg && !starterMsg.deleted_at && starterMsg.body !== null ? (
          <div>
            <div className="font-semibold text-foreground">
              {displayName(starterMsg.author)}
            </div>
            <div className="text-muted-foreground mt-0.5 line-clamp-2">
              {starterMsg.body}
            </div>
          </div>
        ) : (
          <em className="text-muted-foreground">Starter message was deleted</em>
        )}
      </div>

      <div className="thread-body flex-1 min-h-0 flex flex-col">
        {history.isPending && !send.entries.length ? (
          <ChatMessageSkeleton />
        ) : (
          <>
            <MessageList
              currentUserId={currentUserId}
              currentUserRoleIds={currentUserRoleIds}
              mentionContext={{
                kind: "channel",
                id: parentChannelId,
                communityId,
                name: thread.name,
                threadId,
              }}
              communityId={communityId}
              channel={{ name: thread.name }}
              messages={messages}
              searching={false}
              canSendMessages={thread.can_send && (!thread.locked || thread.can_lock)}
              canCreateThreads={false}
              onReply={(msg) =>
                setReplyingTo({
                  id: msg.id,
                  author_id: msg.author.id,
                  author: msg.author.profile ?? {
                    id: msg.author.id,
                    username: msg.author.name,
                    display_name: msg.author.name,
                    avatar_url: msg.author.avatar ?? null,
                  },
                  body: msg.body,
                  deleted: Boolean(msg.deleted),
                })
              }
              onForward={onForwardMessage}
              onToggleReaction={(messageId, emoji, remove) =>
                toggleReaction.mutate({
                  messageId,
                  emoji: emoji.value,
                  emojiName: emoji.label,
                  emojiUrl: emoji.customUrl ?? null,
                  remove,
                })
              }
              historyControls={
                history.hasNextPage && (
                  <div className="history-controls">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={history.isFetching}
                      onClick={() => void history.fetchNextPage()}
                    >
                      {history.isFetchingNextPage ? "Loading…" : "Load older replies"}
                    </Button>
                  </div>
                )
              }
            />
            <ChannelMentionComposer
              key={threadId}
              communityId={communityId}
              channelId={parentChannelId}
              channelName={thread.name}
              canSendMessages={thread.can_send && (!thread.locked || thread.can_lock)}
              disabledReason={
                thread.locked
                  ? "This thread is locked."
                  : "You do not have permission to send messages in this thread."
              }
              replyTo={replyingTo}
              replyMention={replyMention}
              onToggleReplyMention={setReplyMention}
              onCancelReply={() => setReplyingTo(null)}
              onSend={(body, mentions) => {
                send.send(body, mentions, {
                  replyTo: replyingTo,
                  replyMention,
                });
                setReplyingTo(null);
              }}
            />
          </>
        )}
      </div>
    </aside>
  );
}
