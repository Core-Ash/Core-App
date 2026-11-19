import { Brand } from "@/components/common/Brand";

export interface CoreBotNoticeItem {
  id: string;
  createdAt: string;
}

const noticeTime = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

export function CoreBotNotice({
  notice,
  onDismiss,
}: {
  notice: CoreBotNoticeItem;
  onDismiss: () => void;
}) {
  const timestamp = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(notice.createdAt));

  return (
    <li
      className="chat-message core-bot-notice"
      data-testid="core-bot-notice"
      role="alert"
      aria-live="polite"
    >
      <div className="message-avatar-column">
        <div className="core-bot-avatar" aria-hidden="true">
          <Brand markOnly className="core-bot-brand" />
        </div>
      </div>
      <div className="message-content">
        <div className="message-meta">
          <span className="message-author core-bot-name">Core Bot</span>
          <span className="core-bot-badge" aria-label="Bot verified system integration">
            BOT
          </span>
          <time dateTime={notice.createdAt} title={timestamp}>
            {noticeTime.format(new Date(notice.createdAt))}
          </time>
        </div>
        <div className="core-bot-body">
          <p className="core-bot-title">Your message could not be delivered.</p>
          <p className="core-bot-explanation">
            This may be because you cannot message this user, your privacy settings prevent delivery, or messaging is currently unavailable.
          </p>
          <div className="core-bot-footer">
            <span className="core-bot-disclaimer">Only you can see this</span>
            <span className="core-bot-separator" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              className="core-bot-dismiss"
              onClick={onDismiss}
              aria-label="Dismiss message"
            >
              Dismiss message
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
