import { useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Compass, Hash, Menu, X } from "lucide-react";
import { useOutletContext } from "react-router";
import { useAppData } from "@/app/app-data-context";
import { ApiNotice } from "@/components/common/ApiNotice";
import { ChatMessageSkeleton } from "@/components/common/skeleton/Skeletons";
import { EmptyState } from "@/components/common/EmptyState";
import type { WorkspaceNavigation } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  queryKeys,
  useCurrentUser,
  useMembers,
  useMessages,
  useSendMessage,
  useToggleReaction,
} from "@/features/community/api/hooks";
import { mergeConfirmedMessage } from "@/features/community/api/message-cache";
import { useCommunitySelection } from "@/features/community/api/use-community-selection";
import { ApplicationProfileState } from "@/features/community/components/ApplicationProfile";
import { ChatHeader } from "@/features/community/components/ChatHeader";
import { ChannelSettings } from "@/features/community/access/ChannelSettings";
import { ServerEvents } from "@/features/events/ServerEvents";
import { ServerSettings } from "@/features/community/components/ServerSettings";
import { MemberDirectory } from "@/features/community/members/MemberDirectory";
import {
  CreateChannelDialog,
} from "@/features/community/components/CreateResourceDialog";
import { AddServerDialog } from "@/features/community/components/AddServerDialog";
import { ForwardMessageDialog } from "@/features/community/components/ForwardMessageDialog";
import { CreateThreadDialog, ThreadPanel } from "@/features/community/components/ThreadPanel";
import { ChannelMentionComposer } from "@/features/mentions/MentionComposers";
import { MessageList } from "@/features/community/components/MessageList";
import type { ChatMessageData } from "@/features/community/types";
import { endpoints } from "@/lib/api/endpoints";
import type { Channel, Community, MessageReplyReference } from "@/lib/api/types";
import { ApiError } from "@/lib/api/errors";
import { useMediaQuery } from "@/lib/use-media-query";
import { displayName } from "@/lib/display-name";

function WorkspaceState({ children, title = "Welcome to Core" }: { children: ReactNode; title?: string }) {
  const navigation = useOutletContext<WorkspaceNavigation | null>();
  return (
    <div className="page-scroll">
      <header className="chat-header">
        <button
          className="icon-button community-menu-toggle"
          aria-label="Open community navigation"
          onClick={() => navigation?.openNavigation()}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <h1>{title}</h1>
      </header>
      {children}
    </div>
  );
}
function LiveConversation({
  community,
  channel,
}: {
  community: Community;
  channel: Channel;
}) {
  const { api } = useAppData();
  const queries = useQueryClient();
  const history = useMessages(channel.id);
  const currentProfile = useCurrentUser();
  const channelMembers = useMembers(
    community.id,
    channel.id,
    "",
    currentProfile.isSuccess,
  );
  const currentUserRoleIds = useMemo(() => {
    const userId = currentProfile.data?.id;
    if (!userId) return undefined;
    const member = channelMembers.data?.pages
      .flatMap((page) => page.items)
      .find((item) => item.id === userId);
    return member ? new Set(member.roles.map((role) => role.id)) : undefined;
  }, [channelMembers.data?.pages, currentProfile.data?.id]);
  const send = useSendMessage(channel.id);
  const toggleReaction = useToggleReaction(
    "channel",
    channel.id,
    queryKeys.messages(channel.id),
  );
  const wide = useMediaQuery("(min-width: 1200px)");
  const [membersVisible, setMembersVisible] = useState(true);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [replyingTo, setReplyingTo] = useState<MessageReplyReference | null>(null);
  const [replyMention, setReplyMention] = useState(true);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessageData | null>(null);
  const [creatingThreadFrom, setCreatingThreadFrom] = useState<ChatMessageData | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const membersButton = useRef<HTMLButtonElement>(null);

  async function jumpToMessage(messageId: string) {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId((cur) => (cur === messageId ? null : cur)), 2000);
      return;
    }
    try {
      const around = await endpoints.getMessageAround(api, "channel", channel.id, messageId);
      queries.setQueryData(
        queryKeys.messages(channel.id),
        (previous: Parameters<typeof mergeConfirmedMessage>[0]) => {
          let next = previous;
          for (const item of around.items) {
            next = mergeConfirmedMessage(next, item);
          }
          return next;
        },
      );
      requestAnimationFrame(() => {
        document.getElementById(`message-${messageId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        setHighlightedMessageId(messageId);
        setTimeout(() => setHighlightedMessageId((cur) => (cur === messageId ? null : cur)), 2000);
      });
    } catch {
      setToastNotice("Original message is unavailable.");
      setTimeout(() => setToastNotice(null), 2500);
    }
  }

  const messages = useMemo(() => {
    // Server history wins when a refresh confirms an in-flight or failed send.
    const unique = new Map(
      history.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]),
    );
    const local = new Map(send.entries.map((entry) => [entry.message.author_id + ":" + entry.message.client_nonce, entry]));
    for (const item of unique.values()) local.delete(item.author_id + ":" + item.client_nonce);
    const server = [...unique.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
    const items: ChatMessageData[] = [...server, ...[...local.values()].map((entry) => entry.message)]
      // Stable sorting keeps rapid local sends in enqueue order when timestamps tie.
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      .map((item) => {
        const name = displayName(item.author);
        return {
          id: item.id,
          renderKey: item.author_id + ':' + item.client_nonce,
          delivery: local.get(item.author_id + ':' + item.client_nonce)?.status,
          deliveryError: local.get(item.author_id + ':' + item.client_nonce)?.error,
          onRetry: local.get(item.author_id + ':' + item.client_nonce)?.retryable ? () => send.retry(item.client_nonce) : undefined,
          body: item.body ?? "",
          mentions: item.mentions,
          createdAt: item.created_at,
          edited: Boolean(item.edited_at),
          deleted: Boolean(item.deleted_at) || (item.body === null && !item.forwarded && !item.attachments?.length),
          attachments: item.attachments,
          reactions: item.reactions,
          replyToMessageId: item.reply_to_message_id,
          replyMention: item.reply_mention,
          replyTo: item.reply_to,
          forwarded: item.forwarded,
          threadId: item.thread_id,
          thread: item.thread,
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
  const membersOpen = wide ? membersVisible : membersDialogOpen;
  const canCreateThreads =
    channel.can_create_public_threads !== false || channel.can_create_private_threads !== false;
  return (
    <section
      className="chat-workspace"
      data-members-visible={wide && (membersVisible || Boolean(activeThreadId))}
      aria-label={`${community.name} community`}
    >
      <ChatHeader
        name={channel.name}
        communityName={community.name}
        view="channel"
        search={search}
        onSearch={setSearch}
        membersOpen={membersOpen}
        onToggleMembers={() => {
          if (wide) setMembersVisible((value) => !value);
          else setMembersDialogOpen((value) => !value);
        }}
        membersButtonRef={membersButton}
        settings={<ChannelSettings key={channel.id} community={community} channel={channel} />}
      />
      <div className="chat-column">
            {history.isPending && !send.entries.length ? (
              <ChatMessageSkeleton />
            ) : history.error && ((!history.data && !send.entries.length) || (history.error instanceof ApiError && ["unauthorized", "forbidden", "session_transport", "auth_unavailable"].includes(history.error.kind))) ? (
              <ApiNotice
                error={history.error}
                onRetry={() => {
                  void history.refetch();
                }}
              />
            ) : (
              <>
                <MessageList
                  currentUserId={currentProfile.data?.id}
                  currentUserRoleIds={currentUserRoleIds}
                  mentionContext={{ kind: "channel", id: channel.id, communityId: community.id, name: channel.name }}
                  communityId={community.id}
                  channel={channel}
                  messages={messages}
                  searching={Boolean(search.trim())}
                  highlightedMessageId={highlightedMessageId}
                  canSendMessages={channel.can_send_messages !== false}
                  canAddReactions={channel.can_add_reactions !== false}
                  canCreateThreads={canCreateThreads}
                  onReply={(msg) =>
                    setReplyingTo({
                      id: msg.id,
                      author_id: msg.author.id,
                      author: msg.author.profile ?? {
                        id: msg.author.id,
                        username: msg.author.name,
                        display_name: msg.author.name,
                        avatar_url: msg.author.avatar ?? null,
                      },
                      body: msg.body,
                      deleted: Boolean(msg.deleted),
                      has_attachments: Boolean(msg.attachments?.length),
                    })
                  }
                  onForward={(msg) => setForwardingMessage(msg)}
                  onCreateThread={(msg) => setCreatingThreadFrom(msg)}
                  onOpenThread={(tid) => setActiveThreadId(tid)}
                  onJumpToMessage={(mid) => void jumpToMessage(mid)}
                  onToggleReaction={(messageId, emoji, remove) =>
                    toggleReaction.mutate({
                      messageId,
                      emoji: emoji.value,
                      emojiName: emoji.label,
                      emojiUrl: emoji.customUrl ?? null,
                      remove,
                    })
                  }
                  historyControls={
                    history.hasNextPage && <div className="history-controls">
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
                  }
                />
                {toastNotice && (
                  <div role="status" className="px-4 py-1.5 text-xs text-primary bg-primary/10 border-t border-border">
                    {toastNotice}
                  </div>
                )}
                <ChannelMentionComposer
                  key={channel.id}
                  communityId={community.id}
                  channelId={channel.id}
                  channelName={channel.name}
                  canSendMessages={channel.can_send_messages !== false}
                  replyTo={replyingTo}
                  replyMention={replyMention}
                  onToggleReplyMention={setReplyMention}
                  onCancelReply={() => setReplyingTo(null)}
                  onSend={(body, mentions) => {
                    send.send(body, mentions, {
                      replyTo: replyingTo,
                      replyMention,
                    });
                    setReplyingTo(null);
                  }}
                />
              </>
            )}
      </div>
      {activeThreadId ? (
        <ThreadPanel
          threadId={activeThreadId}
          communityId={community.id}
          parentChannelId={channel.id}
          currentUserId={currentProfile.data?.id}
          currentUserRoleIds={currentUserRoleIds}
          onClose={() => setActiveThreadId(null)}
          onForwardMessage={(msg) => setForwardingMessage(msg)}
        />
      ) : wide && membersVisible ? (
        <aside className="member-sidebar" aria-label="Community members">
          <div id="community-members" className="member-sidebar-content"><MemberDirectory communityId={community.id} channelId={channel.id} /></div>
        </aside>
      ) : null}
      {forwardingMessage && (
        <ForwardMessageDialog
          open
          onClose={() => setForwardingMessage(null)}
          message={forwardingMessage}
          sourceKind={forwardingMessage.threadId ? "thread" : "channel"}
          sourceId={forwardingMessage.threadId ?? channel.id}
          onForwarded={(dest) => {
            setToastNotice(`Forwarded to ${dest.label}`);
            setTimeout(() => setToastNotice(null), 2500);
          }}
        />
      )}
      {creatingThreadFrom && (
        <CreateThreadDialog
          open
          onClose={() => setCreatingThreadFrom(null)}
          channelId={channel.id}
          communityId={community.id}
          starterMessage={creatingThreadFrom}
          canCreatePublic={channel.can_create_public_threads !== false}
          canCreatePrivate={channel.can_create_private_threads !== false}
          onCreated={(created) => {
            setActiveThreadId(created.id);
          }}
        />
      )}
      <Dialog.Root
        open={!wide && membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="member-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              membersButton.current?.focus();
            }}
          >
            <Dialog.Title className="sr-only">Community members</Dialog.Title>
            <Dialog.Description className="sr-only">
              Members who can view this channel.
            </Dialog.Description>
            <div id="community-members" className="member-sidebar-content"><MemberDirectory communityId={community.id} channelId={channel.id} /></div>
            <Dialog.Close asChild>
              <button
                className="icon-button dialog-close"
                aria-label="Close members"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

export function LiveCommunityPage() {
  const { configurationError } = useAppData();
  const profile = useCurrentUser();
  const { communities, community, channels, channel, view } =
    useCommunitySelection();
  if (configurationError)
    return (
      <WorkspaceState>
        <ApiNotice error={new ApiError("configuration")} />
      </WorkspaceState>
    );
  if (!profile.isSuccess)
    return (
      <WorkspaceState>
        <ApplicationProfileState />
      </WorkspaceState>
    );
  if (communities.isPending)
    return (
      <WorkspaceState>
        <ApiNotice loading="Loading your communitiesâ€¦" />
      </WorkspaceState>
    );
  if (communities.error)
    return (
      <WorkspaceState>
        <ApiNotice
          error={communities.error}
          onRetry={() => {
            void communities.refetch();
          }}
        />
      </WorkspaceState>
    );
  if (!community)
    return (
      <WorkspaceState>
        <EmptyState
          icon={Compass}
          title="A place for your squad."
          description="Create your own server or join one with an invite link."
        >
          <AddServerDialog>
            <Button>Add a server</Button>
          </AddServerDialog>
          <Button
            variant="outline"
            disabled={communities.isFetching}
            onClick={() => { void communities.refetch(); }}
          >
            {communities.isFetching ? "Refreshingâ€¦" : "Refresh communities"}
          </Button>
        </EmptyState>
      </WorkspaceState>
    );
  if (view === "events") return <WorkspaceState title={community.name}><ServerEvents key={community.id} community={community} /></WorkspaceState>;
  // Server settings remain available even without visible channels.
  if (view !== "channel")
    return (
      <ServerSettings
        community={community}
        profile={profile.data}
        channelId={channel?.id}
        view={view}
      />
    );
  if (channels.isPending)
    return (
      <WorkspaceState>
        <ApiNotice loading="Loading channelsâ€¦" />
      </WorkspaceState>
    );
  if (channels.error)
    return (
      <WorkspaceState>
        <ApiNotice
          error={channels.error}
          onRetry={() => {
            void channels.refetch();
          }}
        />
      </WorkspaceState>
    );
  if (!channel)
    return (
      <WorkspaceState>
        <EmptyState
          icon={Hash}
          title="No visible channels"
          description="Create a channel if you have permission, or ask the community owner for access."
        >
          {community.owner_id === profile.data.id && <CreateChannelDialog communityId={community.id}>
            <Button>Create channel</Button>
          </CreateChannelDialog>}
        </EmptyState>
      </WorkspaceState>
    );
  return (
    <LiveConversation
      key={JSON.stringify([community.id, channel.id, view])}
      community={community}
      channel={channel}
    />
  );
}
