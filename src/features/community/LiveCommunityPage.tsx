import { useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, Compass, Hash, Menu, X } from "lucide-react";
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
import { CommunityMembers } from "@/features/community/components/CommunityMembers";
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

function WorkspaceState({ children }: { children: ReactNode }) {
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
        <h1>Welcome to Core</h1>
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
  const attempt = useRef<{ body: string; client_nonce: string } | null>(null);
  const messages = useMemo(() => {
    // Preserve the backend's newest-first cursor ordering, including timestamp ties.
    const unique = new Map(
      history.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]),
    );
    const items: ChatMessageData[] = [...unique.values()]
      .reverse()
      .map((item) => {
        const name = item.author?.display_name || item.author?.username || `Member ${item.author_id.slice(0, 8)}`;
        return {
          id: item.id,
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
  }, [history.data, search]);
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
            {history.isPending ? (
              <ApiNotice loading="Loading message history…" />
            ) : history.error ? (
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
                    <div className="flex flex-wrap gap-2 p-3">
                      {history.hasNextPage && (
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
                      )}
                      <Button
                        variant="ghost"
                        disabled={history.isFetching}
                        onClick={() => {
                          void history.refetch();
                        }}
                      >
                        {history.isRefetching
                          ? "Refreshing…"
                          : "Refresh history"}
                      </Button>
                    </div>
                  }
                />
                {send.isPending && (
                  <div
                    role="status"
                    aria-label="Pending message"
                    className="px-5 py-2 text-sm text-muted-foreground"
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {send.variables?.body}
                    </p>
                    <span>Sending…</span>
                  </div>
                )}
                <MessageComposer
                  channelName={channel.name}
                  sending={send.isPending}
                  onSend={async (body) => {
                    // A retry of an unchanged draft reuses its nonce, including after a lost response.
                    if (attempt.current?.body !== body)
                      attempt.current = {
                        body,
                        client_nonce: crypto.randomUUID(),
                      };
                    await send.mutateAsync(attempt.current);
                    attempt.current = null;
                  }}
                />
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
  if (view === "members")
    return (
      <WorkspaceState>
        <CommunityMembers community={community} profile={profile.data} />
      </WorkspaceState>
    );
  if (view === "events")
    return (
      <WorkspaceState>
        <EmptyState icon={CalendarDays} title="Events unavailable"
          description="Events aren't available from the application service yet." />
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
          <CreateChannelDialog communityId={community.id}>
            <Button>Create channel</Button>
          </CreateChannelDialog>
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
