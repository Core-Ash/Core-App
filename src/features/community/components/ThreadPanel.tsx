import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Bell,
  Check,
  Copy,
  Ellipsis,
  Hash,
  Lock,
  LockOpen,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  Pencil,
  Search,
  Spool,
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
import { MemberAvatar } from "@/features/community/components/MemberAvatar";
import { MessageList } from "@/features/community/components/MessageList";
import type { ChatMessageData } from "@/features/community/types";
import { ChannelMentionComposer } from "@/features/mentions/MentionComposers";
import { plainMessageText } from "@/features/mentions/model";
import { displayName } from "@/lib/display-name";
import { endpoints } from "@/lib/api/endpoints";
import { apiErrorMessage } from "@/lib/api/errors";
import type { MessageReplyReference, ThreadDetail, ThreadSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function formatRelativeTime(iso: string) {
  const diffSec = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (diffSec < 60) return "just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ThreadIndicator({
  thread,
  onOpenThread,
}: {
  thread: ThreadSummary;
  onOpenThread: (threadId: string) => void;
}) {
  const replyCount = thread.message_count;
  const replyLabel = `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`;
  const lastMsg = thread.last_message;
  const latestAuthor = lastMsg?.author
    ? displayName(lastMsg.author)
    : thread.creator
      ? displayName(thread.creator)
      : thread.participants[0]?.display_name ?? null;
  const latestAvatar =
    lastMsg?.author?.avatar_url ??
    thread.creator?.avatar_url ??
    thread.participants[0]?.avatar_url ??
    undefined;

  return (
    <div className="discord-thread-attached-wrapper">
      <span className="discord-thread-attached-spine" aria-hidden="true" />
      <button
        type="button"
        className="discord-thread-card message-thread-indicator"
        aria-label={`Open thread ${thread.name}, ${replyLabel}`}
        onClick={() => onOpenThread(thread.id)}
      >
        <div className="discord-thread-card-header">
          {thread.thread_type === "private" ? (
            <Lock className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          ) : (
            <Spool className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          )}
          <span className="discord-thread-card-title message-thread-indicator-name">
            {thread.name}
          </span>
          <span className="discord-thread-card-count message-thread-indicator-count">
            {replyLabel} ›
          </span>
          <span className="sr-only message-thread-indicator-link">View Thread</span>
        </div>
        <div className="discord-thread-card-preview">
          {latestAuthor ? (
            <>
              <MemberAvatar
                member={{
                  id: lastMsg?.author?.id ?? thread.creator_id,
                  name: latestAuthor,
                  initials: Array.from(latestAuthor)[0]?.toUpperCase() ?? "?",
                  tone: "slate",
                  avatar: latestAvatar,
                }}
              />
              <span className="discord-thread-card-author">{latestAuthor}</span>
              <span className="discord-thread-card-snippet">
                {lastMsg?.body?.trim()
                  ? lastMsg.body.replace(/\s+/g, " ").slice(0, 90)
                  : "Started a thread"}
              </span>
              <span className="discord-thread-card-time">
                • {formatRelativeTime(lastMsg?.created_at ?? thread.last_activity_at)}
              </span>
            </>
          ) : (
            <span className="discord-thread-card-snippet">
              View thread activity • {formatRelativeTime(thread.last_activity_at)}
            </span>
          )}
        </div>
      </button>
    </div>
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
              <Spool className="size-4 text-primary" />
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
            Start a discussion thread from this message. Server ID {communityId}.
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
                placeholder="Enter a message to start the conversation…"
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
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fullView, setFullView] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageReplyReference | null>(null);
  const [replyMention, setReplyMention] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);

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

    // Include starter message as the very first chronological message in the thread feed, just like Discord!
    const starter = thread?.starter_message;
    if (starter && !unique.has(starter.id)) {
      unique.set(starter.id, starter);
    }

    const server = [...unique.values()].sort(
      (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id),
    );
    const allItems = [...server, ...[...local.values()].map((e) => e.message)]
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      .map((item): ChatMessageData => {
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
          deleted:
            Boolean(item.deleted_at) ||
            (item.body === null && !item.forwarded && !item.attachments?.length),
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

    const term = searchQuery.trim().toLowerCase();
    return term
      ? allItems.filter(
          (item) =>
            !item.deleted &&
            `${item.author.name} ${item.body}`.toLowerCase().includes(term),
        )
      : allItems;
  }, [history.data, searchQuery, send, thread?.starter_message]);

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedFeedback(label);
      setTimeout(() => setCopiedFeedback(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  }

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
  const starterDeleted = !starterMsg || Boolean(starterMsg.deleted_at) || starterMsg.body === null;
  const creatorName = thread.creator
    ? displayName(thread.creator)
    : starterMsg?.author
      ? displayName(starterMsg.author)
      : thread.participants[0]?.display_name ?? "Member";
  const invitableMembers = (channelMembers.data?.pages.flatMap((p) => p.items) ?? []).filter(
    (m) => !thread.participants.some((p) => p.id === m.id),
  );

  return (
    <aside
      className={cn("thread-panel", fullView && "thread-panel--expanded")}
      aria-label={`Thread: ${thread.name}`}
    >
      {/* Discord-style clean top header: [SpoolIcon] Title | [Bell/Join] [More ...] [X] */}
      <header className="thread-panel-header">
        <div className="thread-panel-title-area min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            {thread.thread_type === "private" ? (
              <Lock className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            ) : (
              <Spool className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
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
              <h2 className="thread-panel-heading truncate" title={thread.name}>
                {thread.name}
              </h2>
            )}
            {thread.archived && <span className="thread-badge">Archived</span>}
            {thread.locked && <span className="thread-badge thread-badge-locked">Locked</span>}
          </div>
        </div>

        <div className="thread-panel-controls flex items-center gap-1 shrink-0">
          <button
            type="button"
            className={cn("icon-button size-8", thread.is_joined && "text-foreground")}
            aria-label={thread.is_joined ? "Thread notifications active" : "Join thread"}
            title={thread.is_joined ? "Following thread" : "Join thread"}
            onClick={() =>
              membershipMutation.mutate({ type: thread.is_joined ? "leave" : "join" })
            }
          >
            <Bell className="size-4" />
          </button>

          {/* Discord-style Three-Dots Dropdown Menu (also keeps accessible direct buttons for tests/screen readers) */}
          <Menu.Root modal={false}>
            <Menu.Trigger asChild>
              <button
                type="button"
                className="icon-button size-8"
                aria-label="Thread options"
                title="More"
              >
                <Ellipsis className="size-4" />
              </button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content
                align="end"
                sideOffset={6}
                collisionPadding={10}
                className="core-context-menu thread-options-menu"
                aria-label="Thread options"
              >
                <Menu.Item
                  className="core-context-menu-item"
                  onSelect={() => setFullView((v) => !v)}
                >
                  {fullView ? (
                    <Minimize2 aria-hidden="true" />
                  ) : (
                    <Maximize2 aria-hidden="true" />
                  )}
                  <span className="core-context-menu-label">
                    {fullView ? "Exit Full View" : "Open in Full View"}
                  </span>
                </Menu.Item>

                <Menu.Item
                  className="core-context-menu-item"
                  onSelect={() => setShowParticipants((v) => !v)}
                >
                  <Users aria-hidden="true" />
                  <span className="core-context-menu-label">
                    Thread Members ({thread.participants.length})
                  </span>
                </Menu.Item>

                <Menu.Item
                  className="core-context-menu-item"
                  onSelect={() => setShowSearch((v) => !v)}
                >
                  <Search aria-hidden="true" />
                  <span className="core-context-menu-label">Search Thread</span>
                </Menu.Item>

                <Menu.Separator className="core-context-menu-separator" />

                {thread.can_manage && (
                  <Menu.Item
                    className="core-context-menu-item"
                    onSelect={() => {
                      setNameDraft(thread.name);
                      setRenaming(true);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                    <span className="core-context-menu-label">Edit Thread</span>
                  </Menu.Item>
                )}

                {(thread.can_manage || (thread.archived && !thread.locked && thread.can_send)) && (
                  <Menu.Item
                    className="core-context-menu-item"
                    onSelect={() => updateMutation.mutate({ archived: !thread.archived })}
                  >
                    {thread.archived ? (
                      <ArchiveRestore aria-hidden="true" />
                    ) : (
                      <Archive aria-hidden="true" />
                    )}
                    <span className="core-context-menu-label">
                      {thread.archived ? "Unarchive Thread" : "Close Thread"}
                    </span>
                  </Menu.Item>
                )}

                {thread.can_lock && (
                  <Menu.Item
                    className="core-context-menu-item"
                    onSelect={() => updateMutation.mutate({ locked: !thread.locked })}
                  >
                    {thread.locked ? (
                      <LockOpen aria-hidden="true" />
                    ) : (
                      <Lock aria-hidden="true" />
                    )}
                    <span className="core-context-menu-label">
                      {thread.locked ? "Unlock Thread" : "Lock Thread"}
                    </span>
                  </Menu.Item>
                )}

                {thread.can_delete && (
                  <Menu.Item
                    className="core-context-menu-item"
                    data-tone="danger"
                    onSelect={() => deleteMutation.mutate()}
                  >
                    <Trash2 aria-hidden="true" />
                    <span className="core-context-menu-label">Delete Thread</span>
                  </Menu.Item>
                )}

                <Menu.Separator className="core-context-menu-separator" />

                <Menu.Item
                  className="core-context-menu-item"
                  onSelect={() =>
                    membershipMutation.mutate({
                      type: thread.is_joined ? "leave" : "join",
                    })
                  }
                >
                  {thread.is_joined ? (
                    <LogOut aria-hidden="true" />
                  ) : (
                    <LogIn aria-hidden="true" />
                  )}
                  <span className="core-context-menu-label">
                    {thread.is_joined ? "Leave Thread" : "Join Thread"}
                  </span>
                </Menu.Item>

                <Menu.Separator className="core-context-menu-separator" />

                <Menu.Item
                  className="core-context-menu-item"
                  onSelect={() =>
                    void copyValue(window.location.href, "Thread link copied")
                  }
                >
                  <Copy aria-hidden="true" />
                  <span className="core-context-menu-label">Copy Link</span>
                </Menu.Item>
                <Menu.Item
                  className="core-context-menu-item"
                  onSelect={() => void copyValue(thread.id, "Thread ID copied")}
                >
                  <Hash aria-hidden="true" />
                  <span className="core-context-menu-label">Copy Thread ID</span>
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>

          {/* Compact accessible action triggers for keyboard/screen-reader & existing tests */}
          <div className="sr-only">
            <button
              type="button"
              aria-label="Thread participants"
              onClick={() => setShowParticipants((v) => !v)}
            >
              Participants
            </button>
            {thread.can_manage && (
              <button
                type="button"
                aria-label="Rename thread"
                onClick={() => {
                  setNameDraft(thread.name);
                  setRenaming(true);
                }}
              >
                Rename
              </button>
            )}
            {(thread.can_manage || (thread.archived && !thread.locked && thread.can_send)) && (
              <button
                type="button"
                aria-label={thread.archived ? "Unarchive thread" : "Archive thread"}
                onClick={() => updateMutation.mutate({ archived: !thread.archived })}
              >
                {thread.archived ? "Unarchive" : "Archive"}
              </button>
            )}
            {thread.can_lock && (
              <button
                type="button"
                aria-label={thread.locked ? "Unlock thread" : "Lock thread"}
                onClick={() => updateMutation.mutate({ locked: !thread.locked })}
              >
                {thread.locked ? "Unlock" : "Lock"}
              </button>
            )}
            {thread.can_delete && (
              <button
                type="button"
                aria-label="Delete thread"
                onClick={() => deleteMutation.mutate()}
              >
                Delete
              </button>
            )}
          </div>

          <button
            type="button"
            className="icon-button size-8"
            aria-label="Close thread"
            title="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {copiedFeedback && (
        <div role="status" className="px-3 py-1 text-xs text-primary bg-primary/10 border-b border-border">
          {copiedFeedback}
        </div>
      )}

      {actionError && (
        <p role="alert" className="px-3 py-1.5 text-xs text-destructive bg-destructive/10">
          {actionError}
        </p>
      )}

      {showSearch && (
        <div className="px-3 py-2 border-b border-border bg-secondary/40 flex items-center gap-2">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            type="search"
            className="w-full bg-transparent text-xs outline-none"
            placeholder="Search in thread…"
            aria-label="Search in thread"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="icon-button size-5"
            aria-label="Close thread search"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery("");
            }}
          >
            <X className="size-3.5" />
          </button>
        </div>
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
              searching={Boolean(searchQuery.trim())}
              canSendMessages={thread.can_send && (!thread.locked || thread.can_lock)}
              canCreateThreads={false}
              headerContent={
                <div className="discord-thread-hero">
                  <div className="discord-thread-hero-icon" aria-hidden="true">
                    {thread.thread_type === "private" ? (
                      <Lock className="size-6" />
                    ) : (
                      <Spool className="size-6" />
                    )}
                  </div>
                  <h3 className="discord-thread-hero-title">{thread.name}</h3>
                  <p className="discord-thread-hero-subtitle">
                    Started by <strong>{creatorName}</strong>
                  </p>
                  {starterDeleted && (
                    <p className="mt-2 text-xs italic text-muted-foreground">
                      Original starter message was deleted.
                    </p>
                  )}
                </div>
              }
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
              realtimeConversation={{ type: "thread", id: threadId }}
              key={threadId}
              communityId={communityId}
              channelId={parentChannelId}
              channelName={thread.name}
              placeholder={`Message "${thread.name}"`}
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
