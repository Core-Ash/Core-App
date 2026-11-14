import { useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, Compass, Hash, Menu, Users, X } from "lucide-react";
import { useOutletContext } from "react-router";
import { useAppData } from "@/app/app-data-context";
import { ApiNotice } from "@/components/common/ApiNotice";
import { EmptyState } from "@/components/common/EmptyState";
import type { WorkspaceNavigation } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import {
  useCurrentUser,
  useMessages,
  useSendMessage,
} from "@/features/community/api/hooks";
import { useCommunitySelection } from "@/features/community/api/use-community-selection";
import { ApplicationProfileState } from "@/features/community/components/ApplicationProfile";
import { ChatHeader } from "@/features/community/components/ChatHeader";
import {
  CreateChannelDialog,
  CreateCommunityDialog,
} from "@/features/community/components/CreateResourceDialog";
import { MessageComposer } from "@/features/community/components/MessageComposer";
import { MessageList } from "@/features/community/components/MessageList";
import type {
  ChatMessageData,
  CommunityView,
} from "@/features/community/types";
import type { Channel, Community, Profile } from "@/lib/api/types";
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
function UnavailableMembers() {
  return (
    <div id="community-members">
      <EmptyState
        icon={Users}
        title="Member profiles unavailable"
        description="Member names, avatars, and live activity aren't available from the application service yet. Messages identify other authors by their member ID."
      />
    </div>
  );
}

function LiveConversation({
  community,
  channel,
  profile,
  view,
}: {
  community: Community;
  channel: Channel;
  profile: Profile;
  view: CommunityView;
}) {
  const history = useMessages(view === "channel" ? channel.id : undefined);
  const send = useSendMessage(channel.id);
  const { session } = useAuth();
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
        const own = item.author_id === profile.id;
        const name = own
          ? profile.display_name || profile.username || "You"
          : `Member ${item.author_id.slice(0, 8)}`;
        return {
          id: item.id,
          body: item.body ?? "",
          createdAt: item.created_at,
          edited: Boolean(item.edited_at),
          deleted: Boolean(item.deleted_at) || item.body === null,
          author: {
            id: item.author_id,
            name,
            initials: own ? (Array.from(name)[0]?.toUpperCase() ?? "?") : "?",
            tone: "slate",
            status: "offline",
            avatar: own ? (session?.user.image ?? undefined) : undefined,
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
  }, [history.data, profile, search, session?.user]);
  const membersOpen = wide ? membersVisible : membersDialogOpen;
  return (
    <section
      className="chat-workspace"
      data-members-visible={wide && membersVisible}
      aria-label={`${community.name} community`}
    >
      <ChatHeader
        name={
          view === "channel"
            ? channel.name
            : view === "events"
              ? "Events"
              : "Members"
        }
        communityName={community.name}
        view={view}
        search={search}
        onSearch={setSearch}
        membersOpen={membersOpen}
        onToggleMembers={() => {
          if (wide) setMembersVisible((value) => !value);
          else setMembersDialogOpen((value) => !value);
        }}
        membersButtonRef={membersButton}
        preview={false}
      />
      <div className="chat-column">
        {view !== "channel" ? (
          <div className="page-scroll">
            <EmptyState
              icon={view === "events" ? CalendarDays : Users}
              title={
                view === "events"
                  ? "Events unavailable"
                  : "Member profiles unavailable"
              }
              description="This feature isn't available from the application service yet."
            />
          </div>
        ) : (
          <>
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
                  preview={false}
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
                <MessageComposer
                  channelName={channel.name}
                  preview={false}
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
          </>
        )}
      </div>
      {wide && membersVisible && (
        <aside className="member-sidebar" aria-label="Community members">
          <UnavailableMembers />
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
              Member profiles and activity are unavailable.
            </Dialog.Description>
            <UnavailableMembers />
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
        </EmptyState>
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
      profile={profile.data}
      view={view}
    />
  );
}
