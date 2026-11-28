import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, MessageSquare, Search } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import type { SelectedEmoji } from "@/components/ui/emoji-picker";
import type { ChatMessageData } from "@/features/community/types";
import { ChatMessage } from "@/features/community/components/ChatMessage";
import type { MentionContext } from "@/features/mentions/MentionMessageActions";

const dayLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });

export function MessageList({
  messages,
  channel,
  searching,
  historyControls,
  headerContent,
  communityId,
  footer,
  currentUserId,
  currentUserRoleIds,
  mentionContext,
  highlightedMessageId,
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
  messages: readonly ChatMessageData[];
  channel: { name: string };
  searching: boolean;
  historyControls?: ReactNode;
  headerContent?: ReactNode;
  communityId?: string;
  footer?: ReactNode;
  currentUserId?: string;
  currentUserRoleIds?: ReadonlySet<string> | readonly string[];
  mentionContext?: MentionContext;
  highlightedMessageId?: string | null;
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
  const scrollArea = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const previous = useRef<{ first?: string; last?: string; height: number }>({
    height: 0,
  });

  useLayoutEffect(() => {
    const element = scrollArea.current;
    if (element) {
      const first = messages[0]?.id;
      const last = messages.at(-1)?.id;
      if (
        !searching &&
        previous.current.first &&
        first !== previous.current.first &&
        last === previous.current.last
      ) {
        element.scrollTop += element.scrollHeight - previous.current.height;
      } else if (followLatest.current && (!previous.current.last || last !== previous.current.last))
        element.scrollTop = element.scrollHeight;
      previous.current = { first, last, height: element.scrollHeight };
    }
  }, [messages, searching]);

  return (
    <div className="message-list-container">
      <div
        ref={scrollArea}
        className="message-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${channel.name} message history`}
        onScroll={() => {
          const element = scrollArea.current;
          if (!element) return;
          followLatest.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            100;
          setAwayFromBottom(!followLatest.current);
        }}
      >
        {headerContent}
        {historyControls}
        {searching && (
          <p className="search-results" role="status">
            {messages.length} matching{" "}
            {messages.length === 1 ? "message" : "messages"}
          </p>
        )}
        {messages.length === 0 && !footer && !headerContent ? (
          <EmptyState
            icon={searching ? Search : MessageSquare}
            title={
              searching ? "No matching messages" : "A little quiet in here."
            }
            description={
              searching
                ? "Try another name or a different search term."
                : "Be the first to send a message in this channel."
            }
          />
        ) : (
          <>
            <ol className="message-list" aria-label="Messages">
              {messages.map((message, index) => {
                const previous = messages[index - 1];
                const gap = previous
                  ? new Date(message.createdAt).getTime() -
                    new Date(previous.createdAt).getTime()
                  : Infinity;
                const grouped =
                  !searching &&
                  !message.replyTo &&
                  !message.forwarded &&
                  previous?.author.id === message.author.id &&
                  gap >= 0 &&
                  gap < 300_000 &&
                  new Date(previous.createdAt).toDateString() ===
                    new Date(message.createdAt).toDateString();
                return (
                  <Fragment key={message.renderKey ?? message.id}>
                    {(!previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString()) && (
                      <li role="separator" className="message-date-divider" aria-label={dayLabel.format(new Date(message.createdAt))}>
                        <span>{dayLabel.format(new Date(message.createdAt))}</span>
                      </li>
                    )}
                    <ChatMessage
                      currentUserId={currentUserId}
                      currentUserRoleIds={currentUserRoleIds}
                      mentionContext={mentionContext}
                      message={message}
                      grouped={grouped}
                      highlighted={highlightedMessageId === message.id}
                      communityId={communityId}
                      canSendMessages={canSendMessages}
                      canAddReactions={canAddReactions}
                      canCreateThreads={canCreateThreads}
                      onReply={onReply}
                      onForward={onForward}
                      onCreateThread={onCreateThread}
                      onOpenThread={onOpenThread}
                      onJumpToMessage={onJumpToMessage}
                      onToggleReaction={onToggleReaction}
                    />
                  </Fragment>
                );
              })}
              {footer}
            </ol>
          </>
        )}
      </div>
      {awayFromBottom && messages.length > 0 && (
        <button
          className="jump-to-latest"
          onClick={() => {
            const element = scrollArea.current;
            if (element) element.scrollTop = element.scrollHeight;
            followLatest.current = true;
            setAwayFromBottom(false);
          }}
        >
          <ArrowDown size={14} aria-hidden="true" />
          Jump to latest
        </button>
      )}
    </div>
  );
}
