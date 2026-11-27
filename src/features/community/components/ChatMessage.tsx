import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { MentionText } from "@/features/mentions/MentionText";
import { messageMentionsCurrentUser, plainMessageText } from "@/features/mentions/model";
import { DeleteMessageDialog, InlineMessageEditor, type MentionContext } from "@/features/mentions/MentionMessageActions";
import { cn } from "@/lib/utils";
import type { ChatMessageData } from "@/features/community/types";
import { MemberAvatar } from "@/features/community/components/MemberAvatar";
import { MessageContextMenu } from "@/features/community/components/MessageContextMenu";
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
  message, grouped, communityId, currentUserId, currentUserRoleIds, mentionContext,
}: {
  message: ChatMessageData;
  grouped: boolean;
  communityId?: string;
  currentUserId?: string;
  currentUserRoleIds?: ReadonlySet<string> | readonly string[];
  mentionContext?: MentionContext;
}) {
  const [menu, setMenu] = useState<Point | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState("");
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);
  const timestamp = fullStamp.format(new Date(message.createdAt));
  const settled = !message.deleted && !message.delivery;
  const own = Boolean(mentionContext) && currentUserId === message.author.id && settled;
  const text = message.deleted ? "" : plainMessageText(message.body, message.mentions);

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

  return (
    <li
      className={cn(
        "chat-message",
        grouped && "message-grouped",
        !message.deleted && messageMentionsCurrentUser(message.body, message.mentions, currentUserId, currentUserRoleIds) && "message-mentioned",
        message.delivery && `message-${message.delivery}`,
        menu && "message-menu-open",
        editing && "message-editing",
      )}
      data-delivery={message.delivery ?? "sent"}
      data-message-id={message.id}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      <div className="message-avatar-column">
        {grouped ? (
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
        {!grouped && (
          <div className="message-meta">
            {message.author.profile ? <MemberIdentity profile={message.author.profile} communityId={communityId} avatar={false} username={false} /> : <span className="message-author">{message.author.name}</span>}
            <time dateTime={message.createdAt} title={timestamp} aria-label={timestamp}>{headerStamp(message.createdAt)}</time>
          </div>
        )}
        {editing && mentionContext ? (
          <InlineMessageEditor message={message} context={mentionContext} onClose={() => setEditing(false)} />
        ) : (
          <p className="message-body">
            {message.deleted ? "Message deleted" : <MentionText body={message.body} mentions={message.mentions} communityId={communityId} currentUserId={currentUserId} />}
            {message.edited && !message.deleted && <span className="message-edited"> (edited)</span>}
          </p>
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
          <button type="button" disabled title="Reactions are not available yet" aria-label="Add reaction (unavailable)"><SmilePlus aria-hidden="true" /></button>
          <button type="button" disabled title="Replies are not available yet" aria-label="Reply (unavailable)"><Reply aria-hidden="true" /></button>
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
          canCopyText={Boolean(text.trim())}
          canCopyId={settled}
          canEdit={own}
          canDelete={own}
          returnFocus={returnFocus}
          onDismiss={() => setMenu(null)}
          onCopyText={() => void copy(text, "Text copied")}
          onCopyId={() => void copy(message.id, "ID copied")}
          onEdit={() => { setMenu(null); setEditing(true); }}
          onDelete={() => { setMenu(null); setDeleting(true); }}
        />
      )}
      {deleting && mentionContext && <DeleteMessageDialog message={message} context={mentionContext} onClose={() => setDeleting(false)} />}
    </li>
  );
}
