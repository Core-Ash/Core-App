import { useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, MessageSquare, Search } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import type {
  PreviewChannel,
  PreviewMessage,
} from "@/features/community/preview/types";
import { ChatMessage } from "@/features/community/components/ChatMessage";

export function MessageList({
  messages,
  channel,
  searching,
}: {
  messages: readonly PreviewMessage[];
  channel: PreviewChannel;
  searching: boolean;
}) {
  const scrollArea = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const [awayFromBottom, setAwayFromBottom] = useState(false);

  useLayoutEffect(() => {
    const element = scrollArea.current;
    if (element && (followLatest.current || messages.at(-1)?.local)) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

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
        {searching && (
          <p className="search-results" role="status">
            {messages.length} matching{" "}
            {messages.length === 1 ? "message" : "messages"}
          </p>
        )}
        {messages.length === 0 ? (
          <EmptyState
            icon={searching ? Search : MessageSquare}
            title={
              searching ? "No matching messages" : "A little quiet in here."
            }
            description={
              searching
                ? "Try another name or a different search term."
                : "No sample messages yet. Try the composer to leave a message in this local preview."
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
                  previous?.author.id === message.author.id &&
                  gap >= 0 &&
                  gap < 300_000 &&
                  new Date(previous.createdAt).toDateString() ===
                    new Date(message.createdAt).toDateString() &&
                  previous.local === message.local;
                return (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    grouped={grouped}
                  />
                );
              })}
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
