import { AtSign, CornerUpRight, FileText, Paperclip, Reply, X } from "lucide-react";
import { displayName } from "@/lib/display-name";
import type {
  ForwardedMessageSnapshot,
  MessageAttachment,
  MessageReplyReference,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function ReplyReference({
  replyTo,
  onJump,
}: {
  replyTo: MessageReplyReference;
  onJump?: (messageId: string) => void;
}) {
  const authorName = replyTo.author ? displayName(replyTo.author) : "Original Author";
  const unavailable = replyTo.deleted || (replyTo.body === null && !replyTo.has_attachments);

  return (
    <div className="message-reply-reference" aria-label="Replied message reference">
      <span className="message-reply-spine" aria-hidden="true" />
      <Reply className="size-3.5 shrink-0 text-muted-foreground -scale-x-100" aria-hidden="true" />
      {!unavailable && (
        <span className="message-reply-author">
          {replyTo.author?.avatar_url && (
            <img
              src={replyTo.author.avatar_url}
              alt=""
              className="message-reply-avatar"
            />
          )}
          @{authorName}
        </span>
      )}
      <button
        type="button"
        className={cn(
          "message-reply-preview",
          unavailable && "is-unavailable",
        )}
        disabled={unavailable || !onJump}
        onClick={() => {
          if (!unavailable && onJump) onJump(replyTo.id);
        }}
      >
        {unavailable ? (
          <em>Original message was deleted or is unavailable</em>
        ) : replyTo.body?.trim() ? (
          replyTo.body.replace(/\s+/g, " ").slice(0, 140)
        ) : replyTo.has_attachments ? (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="size-3" /> Click to see attachment
          </span>
        ) : (
          <em>Click to see original message</em>
        )}
      </button>
    </div>
  );
}

export function ComposerReplyBanner({
  replyTo,
  mentionEnabled,
  onToggleMention,
  onCancel,
}: {
  replyTo: MessageReplyReference;
  mentionEnabled: boolean;
  onToggleMention: (enabled: boolean) => void;
  onCancel: () => void;
}) {
  const authorName = replyTo.author ? displayName(replyTo.author) : "User";
  const preview = replyTo.body?.trim()
    ? replyTo.body.replace(/\s+/g, " ").slice(0, 120)
    : "Attachment";

  return (
    <div className="composer-reply-banner" role="region" aria-label={`Replying to ${authorName}`}>
      <div className="composer-reply-info">
        <Reply className="size-3.5 text-primary shrink-0" aria-hidden="true" />
        <span className="composer-reply-target">
          Replying to <strong>{authorName}</strong>
        </span>
        <span className="composer-reply-snippet" title={preview}>
          “{preview}”
        </span>
      </div>
      <div className="composer-reply-actions">
        <button
          type="button"
          role="switch"
          aria-checked={mentionEnabled}
          aria-label="Mention replied user"
          className={cn("composer-reply-mention-toggle", mentionEnabled && "is-active")}
          onClick={() => onToggleMention(!mentionEnabled)}
        >
          <AtSign className="size-3.5" aria-hidden="true" />
          <span>{mentionEnabled ? "ON" : "OFF"}</span>
        </button>
        <button
          type="button"
          className="composer-reply-cancel"
          aria-label="Cancel reply"
          onClick={onCancel}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function MessageAttachmentsView({
  attachments,
}: {
  attachments?: readonly MessageAttachment[];
}) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="message-attachments" role="group" aria-label="Message attachments">
      {attachments.map((att) => {
        const isImage = att.content_type.startsWith("image/");
        return isImage ? (
          <a
            key={att.id}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="message-attachment-image-link"
          >
            <img
              src={att.url}
              alt={att.name}
              className="message-attachment-image"
              loading="lazy"
            />
          </a>
        ) : (
          <a
            key={att.id}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="message-attachment-file"
          >
            <FileText className="size-4 text-primary shrink-0" aria-hidden="true" />
            <span className="truncate font-medium text-sm">{att.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {Math.max(1, Math.round(att.size_bytes / 1024))} KB
            </span>
          </a>
        );
      })}
    </div>
  );
}

export function ForwardedMessageCard({
  forwarded,
}: {
  forwarded: ForwardedMessageSnapshot;
}) {
  const authorName = forwarded.author ? displayName(forwarded.author) : "Original Author";
  return (
    <div className="forwarded-message-card" role="region" aria-label="Forwarded message">
      <div className="forwarded-message-header">
        <CornerUpRight className="size-3.5 shrink-0" aria-hidden="true" />
        <span>Forwarded</span>
      </div>
      <div className="forwarded-message-author">
        {forwarded.author?.avatar_url && (
          <img
            src={forwarded.author.avatar_url}
            alt=""
            className="size-4 rounded-full object-cover"
          />
        )}
        <span>{authorName}</span>
      </div>
      {forwarded.body && <p className="forwarded-message-body">{forwarded.body}</p>}
      <MessageAttachmentsView attachments={forwarded.attachments} />
    </div>
  );
}
