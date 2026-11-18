import { useState } from "react";
import { Plus, Users, X } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { ApiNotice } from "@/components/common/ApiNotice";
import { ConversationSearchDialog } from "@/features/conversations/components/ConversationSearchDialog";
import { UserPanel } from "@/components/layout/UserPanel";
import { Tooltip } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/features/community/api/hooks";
import { CommunitySidebar } from "@/features/community/components/CommunitySidebar";
import { MemberAvatar } from "@/features/community/components/MemberAvatar";
import {
  useConversations,
  useHideConversation,
} from "@/features/conversations/api";
import { DmUserMenu } from "@/features/conversations/components/DmUserMenu";
import { CreateGroupDmDialog } from "@/features/conversations/components/CreateGroupDmDialog";
import type { ConversationSummary } from "@/lib/api/types";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const isPersonal =
    pathname.startsWith("/app/friends") || pathname.startsWith("/app/messages");

  return (
    <div className="app-sidebar">
      {isPersonal ? (
        <PersonalSidebar onNavigate={onNavigate} />
      ) : (
        <CommunitySidebar onNavigate={onNavigate} />
      )}
      <UserPanel onNavigate={onNavigate} />
    </div>
  );
}

function PersonalSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const profile = useCurrentUser();
  const conversationsQuery = useConversations();
  const hideConversation = useHideConversation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [createDmOpen, setCreateDmOpen] = useState(false);

  const currentUserId = profile.data?.id ?? "";
  const conversations = conversationsQuery.data ?? [];

  async function closeConversation(conversationId: string) {
    await hideConversation.mutateAsync(conversationId);
    if (pathname === `/app/messages/${conversationId}`) {
      navigate("/app/messages");
    }
  }

  return (
    <>
      <div className="personal-search">
        <button
          type="button"
          className="w-full text-left"
          onClick={() => setSearchOpen(true)}
          title="Find or start a conversation"
        >
          <span>Find or start a conversation</span>
        </button>
      </div>

      <div className="sidebar-scroll personal-sidebar">
        <nav aria-label="Personal navigation">
          <NavLink
            to="/app/friends"
            className={({ isActive }) =>
              `sidebar-link${isActive ? " is-active" : ""}`
            }
            onClick={onNavigate}
          >
            <Users size={20} aria-hidden="true" />
            <span>Friends</span>
          </NavLink>
        </nav>

        <div className="personal-dm-heading">
          <h2>Direct Messages</h2>
          <Tooltip content="Create DM">
            <button
              type="button"
              className="icon-button hover:text-foreground"
              onClick={() => setCreateDmOpen(true)}
              aria-label="Create Direct Message"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>

        {conversationsQuery.isPending && (
          <p className="personal-dm-empty">Loading conversations…</p>
        )}

        {!conversationsQuery.isPending && conversations.length === 0 && (
          <p className="personal-dm-empty">No conversations yet.</p>
        )}

        {conversations.length > 0 && (
          <ul className="dm-sidebar-list" aria-label="Direct messages">
            {conversations.map((conv) => (
              <ConversationSidebarRow
                key={conv.id}
                conversation={conv}
                currentUserId={currentUserId}
                onHide={(event) => { event.preventDefault(); event.stopPropagation(); void closeConversation(conv.id).catch(() => {}); }}
                onCloseConversation={() => closeConversation(conv.id)}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </div>

      {searchOpen && <ConversationSearchDialog onClose={() => setSearchOpen(false)} onNavigate={onNavigate} />}
      {conversationsQuery.error && <ApiNotice compact error={conversationsQuery.error} onRetry={() => void conversationsQuery.refetch()} />}
      {hideConversation.error && <ApiNotice compact error={hideConversation.error} />}
      <CreateGroupDmDialog
        open={createDmOpen}
        onOpenChange={setCreateDmOpen}
        onCreated={onNavigate}
      />
    </>
  );
}

function ConversationSidebarRow({
  conversation,
  currentUserId,
  onHide,
  onCloseConversation,
  onNavigate,
}: {
  conversation: ConversationSummary;
  currentUserId: string;
  onHide: (e: React.MouseEvent) => void;
  onCloseConversation: () => Promise<void>;
  onNavigate?: () => void;
}) {
  const isDirect = conversation.type === "direct";
  const otherMember = isDirect
    ? conversation.members.find((m) => m.profile.id !== currentUserId) ??
      conversation.members[0]
    : null;

  const title = isDirect
    ? otherMember?.profile.display_name ?? "Direct Message"
    : conversation.name ||
      conversation.members
        .map((m) => m.profile.display_name)
        .slice(0, 3)
        .join(", ");

  const avatar = otherMember?.profile.avatar_url ?? undefined;
  const initials = isDirect
    ? otherMember?.profile.display_name.charAt(0).toUpperCase() ?? "?"
    : undefined;

  const lastSnippet = conversation.last_message?.body ?? "";

  const link = (
      <NavLink
        to={`/app/messages/${conversation.id}`}
        className={({ isActive }) =>
          `dm-sidebar-link${isActive ? " is-active" : ""}`
        }
        onClick={onNavigate}
      >
        <div className="dm-sidebar-avatar">
          {isDirect ? (
            <MemberAvatar
              member={{
                id: otherMember?.profile.id ?? conversation.id,
                name: title,
                initials: initials ?? "?",
                tone: "slate",
                avatar,
              }}
            />
          ) : (
            <div className="dm-sidebar-group-avatar">
              <Users size={16} aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="dm-sidebar-meta">
          <span className="dm-sidebar-name">{title}</span>
          {lastSnippet && (
            <span className="dm-sidebar-preview">{lastSnippet}</span>
          )}
        </div>

        <button
          type="button"
          className="dm-close-button"
          onClick={onHide}
          title="Close conversation"
          aria-label={`Close conversation with ${title}`}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </NavLink>
  );
  return <li className="dm-sidebar-item">{otherMember ?
    <DmUserMenu profile={otherMember.profile} conversationId={conversation.id} onCloseConversation={onCloseConversation}>{link}</DmUserMenu> : link
  }</li>;
}
