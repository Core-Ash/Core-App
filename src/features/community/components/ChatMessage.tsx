import { cn } from "@/lib/utils";
import type { ChatMessageData } from "@/features/community/types";
import { MemberAvatar } from "@/features/community/components/MemberAvatar";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import { CircleAlert } from "lucide-react";
import { UserProfilePopover } from "@/features/profiles/UserProfilePopover";

const messageTime = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

export function ChatMessage({
  message,
  grouped,
  communityId,
}: {
  message: ChatMessageData;
  grouped: boolean;
  communityId?: string;
}) {
  const timestamp = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(message.createdAt));
  return (
    <li
      className={cn(
        "chat-message",
        grouped && "message-grouped",
        message.delivery && `message-${message.delivery}`,
      )}
      data-delivery={message.delivery ?? "sent"}
    >
      <div className="message-avatar-column">
        {grouped ? (
          <><time dateTime={message.createdAt} title={timestamp} aria-label={timestamp} className="grouped-timestamp">
            {messageTime.format(new Date(message.createdAt))}
          </time>
          {message.author.profile && <UserProfilePopover profile={message.author.profile} communityId={communityId} side="right">
            <button type="button" className="message-profile-trigger grouped-profile-trigger" aria-label={`View profile for ${message.author.name}`}><MemberAvatar member={message.author} /></button>
          </UserProfilePopover>}</>
        ) : (
          message.author.profile ? <UserProfilePopover profile={message.author.profile} communityId={communityId} side="right">
            <button type="button" className="message-profile-trigger" aria-label={`View profile for ${message.author.name}`}><MemberAvatar member={message.author} /></button>
          </UserProfilePopover> : <MemberAvatar member={message.author} />
        )}
      </div>
      <div className="message-content">
        {!grouped && (
          <div className="message-meta">
            {message.author.profile ? <MemberIdentity profile={message.author.profile} communityId={communityId} avatar={false} username={false} /> : <span
              className="message-author"
            >
              {message.author.name}
            </span>}
            <time dateTime={message.createdAt}>{timestamp}</time>
          </div>
        )}
        <p className="message-body">
          {message.deleted ? "Message deleted" : message.body}
        </p>
        {message.delivery === "pending" && <span className="sr-only">Sending message</span>}
        {message.delivery === "failed" && <div className="message-delivery-error" role="status">
          <CircleAlert size={12} aria-hidden="true" />
          <span>Message failed to send. {message.deliveryError}</span>
          {message.onRetry && <button type="button" onClick={message.onRetry} aria-label="Retry message">Retry</button>}
        </div>}
        {message.edited && !message.deleted && (
          <span className="text-xs text-muted-foreground">Edited</span>
        )}
      </div>
    </li>
  );
}
