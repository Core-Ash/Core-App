import { useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, X } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/features/auth/auth-context";
import type { AuthUser } from "@/lib/auth-client";
import { useMediaQuery } from "@/lib/use-media-query";
import { ChatHeader } from "@/features/community/components/ChatHeader";
import {
  MemberList,
  MemberSidebar,
} from "@/features/community/components/MemberSidebar";
import { MessageComposer } from "@/features/community/components/MessageComposer";
import { MessageList } from "@/features/community/components/MessageList";
import { previewMessages } from "@/features/community/preview/preview-data";
import { usePreviewSelection } from "@/features/community/preview/use-preview-selection";
import type { PreviewMessage } from "@/features/community/preview/types";
import { useOptionalAppData } from "@/app/app-data-context";
import { LiveCommunityPage } from "@/features/community/LiveCommunityPage";

function CommunityWorkspace({ user }: { user: AuthUser }) {
  const { community, channel, view, channelKey } = usePreviewSelection();
  const wide = useMediaQuery("(min-width: 1200px)");
  const [membersVisible, setMembersVisible] = useState(true);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const membersButton = useRef<HTMLButtonElement>(null);
  const [localMessages, setLocalMessages] = useState<
    Record<string, readonly PreviewMessage[]>
  >({});
  const [searchState, setSearchState] = useState({
    key: channelKey,
    value: "",
  });
  const search = searchState.key === channelKey ? searchState.value : "";
  const messages = useMemo(() => {
    const all = [
      ...(previewMessages[channelKey] ?? []),
      ...(localMessages[channelKey] ?? []),
    ];
    const term = search.trim().toLocaleLowerCase();
    return term
      ? all.filter((message) =>
          `${message.author.name} ${message.body}`
            .toLocaleLowerCase()
            .includes(term),
        )
      : all;
  }, [channelKey, localMessages, search]);
  const membersOpen = wide ? membersVisible : membersDialogOpen;
  const channelView = view === "channel" || view === "overview";
  function addLocalMessage(body: string) {
    const message: PreviewMessage = {
      id: `local-${crypto.randomUUID()}`,
      author: {
        id: user.id,
        name: user.name || "You",
        avatar: user.image ?? undefined,
        initials: (user.name.trim() || user.email)
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => Array.from(part)[0] ?? "")
          .join("")
          .toLocaleUpperCase(),
        tone: "rose",
        status: "online",
      },
      body,
      createdAt: new Date().toISOString(),
      local: true,
    };
    setLocalMessages((previous) => ({
      ...previous,
      [channelKey]: [...(previous[channelKey] ?? []), message],
    }));
  }
  return (
    <section
      className="chat-workspace"
      data-members-visible={wide && membersVisible}
      aria-label={`${community.name} community preview`}
    >
      <ChatHeader
        name={
          channelView ? channel.name : view === "events" ? "Events" : "Members"
        }
        communityName={community.name}
        view={channelView ? "channel" : view}
        search={search}
        onSearch={(value) => setSearchState({ key: channelKey, value })}
        membersOpen={membersOpen}
        onToggleMembers={() => {
          if (wide) setMembersVisible((visible) => !visible);
          else setMembersDialogOpen((open) => !open);
        }}
        membersButtonRef={membersButton}
      />
      <div className="chat-column">
        {channelView ? (
          <>
            <MessageList
              key={`history:${channelKey}`}
              channel={channel}
              messages={messages}
              searching={Boolean(search.trim())}
            />
            <MessageComposer
              key={`composer:${channelKey}`}
              channelName={channel.name}
              onSend={addLocalMessage}
            />
          </>
        ) : (
          <div className="page-scroll">
            {view === "events" ? (
              <EmptyState
                icon={CalendarDays}
                title="No events scheduled."
                description="Community events aren’t available in this design preview."
              />
            ) : (
              <div className="member-directory">
                <h2>Members</h2>
                <p>Sample profiles and game activity.</p>
                <MemberList community={community} />
              </div>
            )}
            <p className="preview-status">
              Design preview · sample communities and activity.
            </p>
          </div>
        )}
      </div>
      {wide && membersVisible && (
        <aside
          className="member-sidebar"
          aria-label="Community member activity"
        >
          <MemberSidebar community={community} />
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
              Sample members and gaming activity.
            </Dialog.Description>
            <MemberSidebar community={community} />
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

export function CommunityPage() {
  const { session } = useAuth();
  const data = useOptionalAppData();
  if (data?.configured) return <LiveCommunityPage />;
  return session ? (
    <CommunityWorkspace key={session.user.id} user={session.user} />
  ) : null;
}
