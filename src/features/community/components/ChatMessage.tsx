import { cn } from "@/lib/utils";
import type { ChatMessageData } from "@/features/community/types";
import { MemberAvatar } from "@/features/community/components/MemberAvatar";
import { MessageReactions } from "@/features/community/components/MessageReactions";
import { CommunityEmblem } from "@/features/community/components/CommunityEmblem";

const messageTime = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

export function ChatMessage({
  message,
  grouped,
  preview = true,
}: {
  message: ChatMessageData;
  grouped: boolean;
  preview?: boolean;
}) {
  const timestamp =
    message.timestampLabel ??
    (preview
      ? `Today at ${messageTime.format(new Date(message.createdAt))}`
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(message.createdAt)));
  return (
    <li
      className={cn(
        "chat-message",
        grouped && "message-grouped",
        message.local && "message-local",
      )}
    >
      <div className="message-avatar-column">
        {grouped ? (
          <time dateTime={message.createdAt} className="grouped-timestamp">
            {messageTime.format(new Date(message.createdAt))}
          </time>
        ) : (
          <MemberAvatar
            member={message.author}
            sample={preview && !message.local}
          />
        )}
      </div>
      <div className="message-content">
        {!grouped && (
          <div className="message-meta">
            <span
              className="message-author"
              title={preview ? undefined : message.author.id}
            >
              {message.author.name}
            </span>
            <time dateTime={message.createdAt}>{timestamp}</time>
            {message.local && (
              <span className="local-message-label">Only visible to you</span>
            )}
          </div>
        )}
        <p className="message-body">
          {message.deleted ? (
            "Message deleted"
          ) : preview && !message.local && message.body.endsWith("🎮") ? (
            <>
              {message.body.slice(0, -2)}
              <span
                className="message-gamepad"
                role="img"
                aria-label="Game controller"
              >
                <CommunityEmblem emblem="gamepad" />
              </span>
            </>
          ) : (
            message.body
          )}
        </p>
        {message.edited && !message.deleted && (
          <span className="text-xs text-muted-foreground">Edited</span>
        )}
        {message.attachment && (
          <figure className="message-attachment">
            <img
              src={message.attachment.src}
              alt={message.attachment.alt}
              width={540}
              height={223}
            />
          </figure>
        )}
        {message.reactions && (
          <MessageReactions reactions={message.reactions} />
        )}
      </div>
    </li>
  );
}
