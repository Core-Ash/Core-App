import { cn } from "@/lib/utils";
import type { ChatMessageData } from "@/features/community/types";
import { MemberAvatar } from "@/features/community/components/MemberAvatar";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";

const messageTime = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

export function ChatMessage({
  message,
  grouped,
}: {
  message: ChatMessageData;
  grouped: boolean;
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
      )}
    >
      <div className="message-avatar-column">
        {grouped ? (
          <time dateTime={message.createdAt} className="grouped-timestamp">
            {messageTime.format(new Date(message.createdAt))}
          </time>
        ) : (
          <MemberAvatar member={message.author} />
        )}
      </div>
      <div className="message-content">
        {!grouped && (
          <div className="message-meta">
            {message.author.profile ? <MemberIdentity profile={message.author.profile} avatar={false} username={false} /> : <span
              className="message-author"
              title={message.author.id}
            >
              {message.author.name}
            </span>}
            <time dateTime={message.createdAt}>{timestamp}</time>
          </div>
        )}
        <p className="message-body">
          {message.deleted ? "Message deleted" : message.body}
        </p>
        {message.edited && !message.deleted && (
          <span className="text-xs text-muted-foreground">Edited</span>
        )}
      </div>
    </li>
  );
}
