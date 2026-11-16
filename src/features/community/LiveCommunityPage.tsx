import { useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Compass, Hash, Menu, X } from "lucide-react";
import { useOutletContext } from "react-router";
import { useAppData } from "@/app/app-data-context";
import { ApiNotice } from "@/components/common/ApiNotice";
import { EmptyState } from "@/components/common/EmptyState";
import type { WorkspaceNavigation } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  useCurrentUser,
  useMessages,
  useSendMessage,
} from "@/features/community/api/hooks";
import { useCommunitySelection } from "@/features/community/api/use-community-selection";
import { ApplicationProfileState } from "@/features/community/components/ApplicationProfile";
import { ChatHeader } from "@/features/community/components/ChatHeader";
import { ChannelSettings } from "@/features/community/access/ChannelSettings";
import { ServerSettings } from "@/features/community/components/ServerSettings";
import { MemberDirectory } from "@/features/community/members/MemberDirectory";
import {
  CreateChannelDialog,
  CreateCommunityDialog,
} from "@/features/community/components/CreateResourceDialog";
import { MessageComposer } from "@/features/community/components/MessageComposer";
import { MessageList } from "@/features/community/components/MessageList";
import type { ChatMessageData } from "@/features/community/types";
import type { Channel, Community } from "@/lib/api/types";
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
  const history = useMessages(channel.id);
  const send = useSendMessage(channel.id);
  const wide = useMediaQuery("(min-width: 1200px)");
  const [membersVisible, setMembersVisible] = useState(true);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const membersButton = useRef<HTMLButtonElement>(null);
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
  const membersOpen = wide ? membersVisible : membersDialogOpen;
  return (
    <section
      className="chat-workspace"
      data-members-visible={wide && membersVisible}
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
              <ApiNotice loading="Loading message history…" />
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
                  channel={channel}
                  messages={messages}
                  searching={Boolean(search.trim())}
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
                <MessageComposer channelName={channel.name} onSend={send.send} />
              </>
            )}
      </div>
      {wide && membersVisible && (
        <aside className="member-sidebar" aria-label="Community members">
          <div id="community-members" className="member-sidebar-content"><MemberDirectory communityId={community.id} channelId={channel.id} /></div>
        </aside>
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
        <ApiNotice loading="Loading your communities…" />
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
          description="You don't belong to any communities yet. Create one to get started."
        >
          <CreateCommunityDialog>
            <Button>Create community</Button>
          </CreateCommunityDialog>
          <Button
            variant="outline"
            disabled={communities.isFetching}
            onClick={() => { void communities.refetch(); }}
          >
            {communities.isFetching ? "Refreshing…" : "Refresh communities"}
          </Button>
        </EmptyState>
      </WorkspaceState>
    );
  // Membership admission and unavailable-feature notices do not depend on a
  // visible channel. Owners must be able to add members to an empty community.
  if (view !== "channel")
    return (
      <WorkspaceState title={community.name}>
        <ServerSettings community={community} profile={profile.data} channelId={channel?.id} view={view} />
      </WorkspaceState>
    );
  if (channels.isPending)
    return (
      <WorkspaceState>
        <ApiNotice loading="Loading channels…" />
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
