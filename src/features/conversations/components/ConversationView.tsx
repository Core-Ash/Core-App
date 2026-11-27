import { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiNotice } from "@/components/common/ApiNotice";
import { ChatMessageSkeleton } from "@/components/common/skeleton/Skeletons";
import { useCurrentUser } from "@/features/community/api/hooks";
import { ConversationMentionComposer } from "@/features/mentions/MentionComposers";
import { MessageList } from "@/features/community/components/MessageList";
import type { ChatMessageData } from "@/features/community/types";
import {
  useConversation,
  useConversationMessages,
  useConversationNotices,
  useSendConversationMessage,
} from "@/features/conversations/api";
import { ConversationHeader } from "@/features/conversations/components/ConversationHeader";
import { CoreBotNotice } from "@/features/conversations/components/CoreBotNotice";
import { GroupMemberList } from "@/features/conversations/components/GroupMemberList";
import { displayName } from "@/lib/display-name";
import { useMediaQuery } from "@/lib/use-media-query";

export function ConversationView({
  conversationId,
}: {
  conversationId: string;
}) {
  const profile = useCurrentUser();
  const conversationQuery = useConversation(conversationId);
  const history = useConversationMessages(conversationId);
  const send = useSendConversationMessage(conversationId);
  const { notices, dismiss: dismissNotice } = useConversationNotices(conversationId);

  const wide = useMediaQuery("(min-width: 1200px)");
  const [membersVisible, setMembersVisible] = useState(true);
  const [search, setSearch] = useState("");

  const conversation = conversationQuery.data;
  const currentUserId = profile.data?.id ?? "";

  const messages = useMemo(() => {
    const unique = new Map(
      history.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]),
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

    const server = [...unique.values()].sort(
      (a, b) =>
        Date.parse(a.created_at) - Date.parse(b.created_at) ||
        a.id.localeCompare(b.id),
    );

    const items: ChatMessageData[] = [
      ...server,
      ...[...local.values()].map((entry) => entry.message),
    ]
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      .map((item) => {
        const name = displayName(item.author);
        return {
          id: item.id,
          renderKey: item.author_id + ":" + item.client_nonce,
          delivery: local.get(item.author_id + ":" + item.client_nonce)?.status,
          deliveryError: local.get(
            item.author_id + ":" + item.client_nonce,
          )?.error,
          onRetry: local.get(item.author_id + ":" + item.client_nonce)?.retryable
            ? () => send.retry(item.client_nonce)
            : undefined,
          body: item.body ?? "",
          mentions: item.mentions,
          createdAt: item.created_at,
          edited: Boolean(item.edited_at),
          deleted: Boolean(item.deleted_at) || item.body === null,
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

    const term = search.trim().toLocaleLowerCase();
    return term
      ? items.filter(
          (item) =>
            !item.deleted &&
            `${item.author.name} ${item.body}`
              .toLocaleLowerCase()
              .includes(term),
        )
      : items;
  }, [history.data, search, send]);

  if (conversationQuery.isPending) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
        <p>Loading conversation…</p>
      </div>
    );
  }

  if (conversationQuery.error || !conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <MessageSquare size={48} className="text-muted-foreground" />
        <h2 className="text-xl font-semibold">Unable to load conversation</h2>
        <ApiNotice error={conversationQuery.error} onRetry={() => void conversationQuery.refetch()} />
      </div>
    );
  }

  const isGroup = conversation.type === "group";
  const otherMember = !isGroup
    ? conversation.members.find((m) => m.profile.id !== currentUserId) ??
      conversation.members[0]
    : null;

  const targetName = isGroup
    ? conversation.name ||
      conversation.members
        .map((m) => m.profile.display_name)
        .slice(0, 3)
        .join(", ")
    : otherMember?.profile.display_name ?? "Direct Message";

  return (
    <section
      className="chat-workspace conversation-workspace"
      data-members-visible={isGroup && wide && membersVisible}
      aria-label={`Conversation with ${targetName}`}
    >
      <ConversationHeader
        conversation={conversation}
        currentUserId={currentUserId}
        membersVisible={membersVisible}
        onToggleMembers={() => setMembersVisible((v) => !v)}
        search={search}
        onSearch={setSearch}
      />

      <div className="chat-column">
        {history.isPending && !send.entries.length ? (
          <ChatMessageSkeleton />
        ) : history.error &&
          !history.data &&
          !send.entries.length ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-destructive">Failed to load message history.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void history.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            <MessageList
              currentUserId={currentUserId}
              mentionContext={{ kind: "conversation", id: conversationId, name: targetName, participants: conversation.members.map((m) => m.profile) }}
              channel={{ name: targetName }}
              messages={messages}
              searching={Boolean(search.trim())}
              historyControls={
                history.hasNextPage && (
                  <div className="history-controls">
                    <Button
                      variant="outline"
                      disabled={history.isFetching}
                      onClick={() => {
                        void history.fetchNextPage();
                      }}
                    >
                      {history.isFetchingNextPage
                        ? "Loading…"
                        : "Load older messages"}
                    </Button>
                  </div>
                )
              }
              footer={
                notices.map((notice) => (
                  <CoreBotNotice
                    key={notice.id}
                    notice={notice}
                    onDismiss={() => dismissNotice(notice.id)}
                  />
                ))
              }
            />
            <ConversationMentionComposer key={conversationId} participants={conversation.members.map((m) => m.profile)} channelName={targetName} onSend={send.send} />
          </>
        )}
      </div>

      {isGroup && wide && membersVisible && (
        <aside
          className="member-sidebar"
          aria-label="Group conversation members"
        >
          <GroupMemberList
            conversationId={conversation.id}
            members={conversation.members}
            currentUserId={currentUserId}
            currentUserRole={conversation.role}
          />
        </aside>
      )}
    </section>
  );
}
