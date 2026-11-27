import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { MentionText } from "@/features/mentions/MentionText";
import { messageMentionsCurrentUser, plainMessageText } from "@/features/mentions/model";
import { DeleteMessageDialog, InlineMessageEditor, type MentionContext } from "@/features/mentions/MentionMessageActions";
import { cn } from "@/lib/utils";
import type { ChatMessageData } from "@/features/community/types";
import { FloatingEmojiPicker, type SelectedEmoji } from "@/components/ui/emoji-picker";
import { MemberAvatar } from "@/features/community/components/MemberAvatar";
import { MessageContextMenu } from "@/features/community/components/MessageContextMenu";
import { MessageReactions } from "@/features/community/components/MessageReactions";
import {
  ForwardedMessageCard,
  MessageAttachmentsView,
  ReplyReference,
} from "@/features/community/components/MessageReplyAndForward";
import { ThreadIndicator } from "@/features/community/components/ThreadPanel";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import { CircleAlert, Ellipsis, Reply, SmilePlus } from "lucide-react";
import { UserProfilePopover } from "@/features/profiles/UserProfilePopover";
import { UserContextMenu } from "@/features/profiles/UserContextMenu";

const messageTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const fullStamp = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const dayStamp = new Intl.DateTimeFormat(undefined, { dateStyle: "short" });

// Discord-style "Today at 15:32" header stamps; the full date stays in the title.
function headerStamp(value: string) {
  const date = new Date(value);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);
  const time = messageTime.format(date);
  return days === 0 ? `Today at ${time}` : days === 1 ? `Yesterday at ${time}` : `${dayStamp.format(date)} ${time}`;
}

type Point = { x: number; y: number };

export function ChatMessage({
  message,
  grouped,
  highlighted = false,
  communityId,
  currentUserId,
  currentUserRoleIds,
  mentionContext,
  canSendMessages = true,
  canAddReactions = true,
  canCreateThreads = true,
  onReply,
  onForward,
  onCreateThread,
  onOpenThread,
  onJumpToMessage,
  onToggleReaction,
}: {
  message: ChatMessageData;
  grouped: boolean;
  highlighted?: boolean;
  communityId?: string;
  currentUserId?: string;
  currentUserRoleIds?: ReadonlySet<string> | readonly string[];
  mentionContext?: MentionContext;
  canSendMessages?: boolean;
  canAddReactions?: boolean;
  canCreateThreads?: boolean;
  onReply?: (message: ChatMessageData) => void;
  onForward?: (message: ChatMessageData) => void;
  onCreateThread?: (message: ChatMessageData) => void;
  onOpenThread?: (threadId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  onToggleReaction?: (messageId: string, emoji: SelectedEmoji, remove: boolean) => void;
}) {
  const [menu, setMenu] = useState<Point | null>(null);
  const [reactionPickerPos, setReactionPickerPos] = useState<Point | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState("");
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);
  const timestamp = fullStamp.format(new Date(message.createdAt));
  const settled = !message.deleted && !message.delivery;
  const own = Boolean(mentionContext) && currentUserId === message.author.id && settled;
  const text = message.deleted ? "" : plainMessageText(message.body, message.mentions);

  const isServerChannel = mentionContext?.kind === "channel" && !mentionContext.threadId;
  const hasReplyReference = Boolean(message.replyTo);
  // Messages with a reply reference always render their full header so the reply connector aligns properly above the avatar/author
  const effectiveGrouped = grouped && !hasReplyReference;

  function open(point: Point, target: HTMLElement | null) {
    setReturnFocus(target);
    setMenu(point);
  }
  function onContextMenu(event: MouseEvent<HTMLLIElement>) {
    if (!settled || editing || (event.target instanceof Element && event.target.closest("textarea, input"))) return;
    event.preventDefault();
    open({ x: event.clientX, y: event.clientY }, null);
  }
  function onKeyDown(event: KeyboardEvent<HTMLLIElement>) {
    if (!settled || editing || (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10"))) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    open({ x: rect.left + 56, y: rect.top + 24 }, event.target as HTMLElement);
  }
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied(""), 1600); }
    catch { setCopied("Couldn't copy"); setTimeout(() => setCopied(""), 1600); }
  }

  function handleReactionPick(emoji: SelectedEmoji) {
    if (!settled || !onToggleReaction) return;
    const existing = message.reactions?.find((r) => r.emoji === emoji.value);
    onToggleReaction(message.id, emoji, Boolean(existing?.me));
  }

  const isMentioned =
    !message.deleted &&
    (messageMentionsCurrentUser(message.body, message.mentions, currentUserId, currentUserRoleIds) ||
      (Boolean(currentUserId) &&
        message.replyMention &&
        message.replyTo?.author_id === currentUserId));

  return (
    <li
      id={`message-${message.id}`}
      className={cn(
        "chat-message",
        effectiveGrouped && "message-grouped",
        hasReplyReference && "message-has-reply",
        isMentioned && "message-mentioned",
        highlighted && "message-jump-highlighted",
        message.delivery && `message-${message.delivery}`,
        menu && "message-menu-open",
        editing && "message-editing",
      )}
      data-delivery={message.delivery ?? "sent"}
      data-message-id={message.id}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      {message.replyTo && (
        <div className="col-span-full">
          <ReplyReference replyTo={message.replyTo} onJump={onJumpToMessage} />
        </div>
      )}
      <div className="message-avatar-column">
        {effectiveGrouped ? (
          <>
            <time dateTime={message.createdAt} title={timestamp} aria-label={timestamp} className="grouped-timestamp">
              {messageTime.format(new Date(message.createdAt))}
            </time>
            {message.author.profile && (
              <UserContextMenu profile={message.author.profile}>
                <UserProfilePopover profile={message.author.profile} communityId={communityId} side="right">
                  <button type="button" className="message-profile-trigger grouped-profile-trigger" aria-label={`View profile for ${message.author.name}`}><MemberAvatar member={message.author} /></button>
                </UserProfilePopover>
              </UserContextMenu>
            )}
          </>
        ) : message.author.profile ? (
          <UserContextMenu profile={message.author.profile}>
            <UserProfilePopover profile={message.author.profile} communityId={communityId} side="right">
              <button type="button" className="message-profile-trigger" aria-label={`View profile for ${message.author.name}`}><MemberAvatar member={message.author} /></button>
            </UserProfilePopover>
          </UserContextMenu>
        ) : <MemberAvatar member={message.author} />}
      </div>
      <div className="message-content">
        {!effectiveGrouped && (
          <div className="message-meta">
            {message.author.profile ? <MemberIdentity profile={message.author.profile} communityId={communityId} avatar={false} username={false} /> : <span className="message-author">{message.author.name}</span>}
            <time dateTime={message.createdAt} title={timestamp} aria-label={timestamp}>{headerStamp(message.createdAt)}</time>
          </div>
        )}
        {editing && mentionContext ? (
          <InlineMessageEditor message={message} context={mentionContext} onClose={() => setEditing(false)} />
        ) : (
          <>
            {!message.deleted && message.forwarded ? (
              <>
                {message.body && message.body !== message.forwarded.body && (
                  <p className="message-body">
                    <MentionText body={message.body} mentions={message.mentions} communityId={communityId} currentUserId={currentUserId} />
                  </p>
                )}
                <ForwardedMessageCard forwarded={message.forwarded} />
              </>
            ) : (
              <p className="message-body">
                {message.deleted ? "Message deleted" : <MentionText body={message.body} mentions={message.mentions} communityId={communityId} currentUserId={currentUserId} />}
                {message.edited && !message.deleted && <span className="message-edited"> (edited)</span>}
              </p>
            )}
            {!message.deleted && !message.forwarded && (
              <MessageAttachmentsView attachments={message.attachments} />
            )}
          </>
        )}
        {!message.deleted && message.reactions && message.reactions.length > 0 && mentionContext && (
          <MessageReactions
            reactions={message.reactions}
            canAddNewReactions={canAddReactions && settled}
            communityId={communityId}
            scopeKind={mentionContext.kind}
            scopeId={mentionContext.id}
            messageId={message.id}
            onToggleReaction={(emoji, remove) => onToggleReaction?.(message.id, emoji, remove)}
          />
        )}
        {!message.deleted && message.thread && onOpenThread && (
          <ThreadIndicator thread={message.thread} onOpenThread={onOpenThread} />
        )}
        {message.delivery === "pending" && <span className="sr-only">Sending message</span>}
        {message.delivery === "failed" && <div className="message-delivery-error" role="status">
          <CircleAlert size={12} aria-hidden="true" />
          <span>Message failed to send. {message.deliveryError}</span>
          {message.onRetry && <button type="button" onClick={message.onRetry} aria-label="Retry message">Retry</button>}
        </div>}
      </div>
      {settled && !editing && (
        <div className="message-toolbar" role="toolbar" aria-label="Message actions">
          <button
            type="button"
            disabled={!canAddReactions}
            title={canAddReactions ? "Add reaction" : "Reactions unavailable"}
            aria-label="Add reaction"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setReactionPickerPos({ x: rect.left, y: rect.bottom + 4 });
            }}
          >
            <SmilePlus aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!canSendMessages}
            title={canSendMessages ? "Reply" : "Replies unavailable"}
            aria-label="Reply"
            onClick={() => onReply?.(message)}
          >
            <Reply aria-hidden="true" />
          </button>
          <button type="button" aria-label="More options" aria-haspopup="menu" aria-expanded={Boolean(menu)} title="More"
            onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); open({ x: rect.right, y: rect.bottom + 4 }, event.currentTarget); }}>
            <Ellipsis aria-hidden="true" />
          </button>
        </div>
      )}
      {copied && <span className="message-copy-feedback" role="status">{copied}</span>}
      {menu && (
        <MessageContextMenu
          position={menu}
          canReact={canAddReactions && settled}
          canReply={canSendMessages && settled}
          canForward={settled}
          showCreateThread={isServerChannel}
          canCreateThread={canCreateThreads && settled}
          hasThread={Boolean(message.thread)}
          canCopyText={Boolean(text.trim())}
          canCopyId={settled}
          canEdit={own && !message.forwarded}
          canDelete={own}
          returnFocus={returnFocus}
          onDismiss={() => setMenu(null)}
          onQuickReact={(emoji) => handleReactionPick(emoji)}
          onOpenReactionPicker={(anchor) => {
            setMenu(null);
            setReactionPickerPos(anchor);
          }}
          onReply={() => {
            setMenu(null);
            onReply?.(message);
          }}
          onForward={() => {
            setMenu(null);
            onForward?.(message);
          }}
          onCreateThread={() => {
            setMenu(null);
            onCreateThread?.(message);
          }}
          onOpenThread={() => {
            setMenu(null);
            if (message.thread) onOpenThread?.(message.thread.id);
          }}
          onCopyText={() => void copy(text, "Text copied")}
          onCopyId={() => void copy(message.id, "ID copied")}
          onEdit={() => { setMenu(null); setEditing(true); }}
          onDelete={() => { setMenu(null); setDeleting(true); }}
        />
      )}
      <FloatingEmojiPicker
        open={Boolean(reactionPickerPos)}
        position={reactionPickerPos}
        communityId={communityId}
        onClose={() => setReactionPickerPos(null)}
        onSelect={handleReactionPick}
      />
      {deleting && mentionContext && <DeleteMessageDialog message={message} context={mentionContext} onClose={() => setDeleting(false)} />}
    </li>
  );
}
