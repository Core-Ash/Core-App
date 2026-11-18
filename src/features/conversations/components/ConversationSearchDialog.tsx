import { useId, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, Users, X } from "lucide-react";
import { ApiNotice } from "@/components/common/ApiNotice";
import { UserAvatar } from "@/components/common/UserAvatar";
import { ModalContent } from "@/components/ui/modal-content";
import { Button } from "@/components/ui/button";
import { useConversations } from "@/features/conversations/api";
import { useOpenConversation } from "@/features/conversations/use-open-conversation";
import { useFriendList } from "@/features/friends/api";
import { useCurrentUser } from "@/features/community/api/hooks";
import { fullUsername } from "@/lib/display-name";

export function ConversationSearchDialog({ onClose, onNavigate }: { onClose: () => void; onNavigate?: () => void }) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const submitting = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const resultList = useRef<HTMLDivElement>(null);
  const listId = useId();
  const conversations = useConversations();
  const friends = useFriendList("friends");
  const me = useCurrentUser();
  const opener = useOpenConversation();
  const term = search.trim().toLowerCase();
  const existing = conversations.data ?? [];
  const results = existing.map((conversation) => {
    const others = conversation.members.filter((member) => member.id !== me.data?.id);
    const name = conversation.name || others.map((member) => member.profile.display_name).join(", ");
    const handles = others.map((member) => fullUsername(member.profile)).join(", ");
    return { key: conversation.id, name, handles, avatar: others[0]?.profile.avatar_url, group: conversation.type === "group", select: async () => opener.openExisting(conversation.id) };
  });
  const seen = new Set<string>();
  for (const friend of friends.data?.pages.flatMap((page) => page.items) ?? []) {
    if (friend.id === me.data?.id || seen.has(friend.id) || existing.some((conversation) => conversation.type === "direct" && conversation.members.some((member) => member.id === friend.id))) continue;
    seen.add(friend.id);
    results.push({ key: friend.id, name: friend.display_name, handles: fullUsername(friend), avatar: friend.avatar_url, group: false, select: () => opener.openDirect(friend.id) });
  }
  const matching = results.filter((item) => `${item.name} ${item.handles}`.toLowerCase().includes(term));
  const activeIndex = Math.min(selectedIndex, matching.length - 1);

  async function select(index: number) {
    const item = matching[index];
    if (!item || submitting.current) return;
    submitting.current = true;
    setSelecting(true);
    try { await item.select(); onClose(); onNavigate?.(); }
    catch { /* The shared opener exposes the API error below. */ }
    finally { submitting.current = false; setSelecting(false); }
  }
  function move(direction: number) {
    if (!matching.length) return;
    const index = (activeIndex + direction + matching.length) % matching.length;
    setSelectedIndex(index);
    resultList.current?.querySelectorAll<HTMLElement>('[role="option"]')[index]?.scrollIntoView?.({ block: "nearest" });
    searchInput.current?.focus();
  }

  return <Dialog.Root open onOpenChange={(open) => { if (!open && !submitting.current) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <ModalContent className="group-dm-dialog conversation-search-dialog" aria-describedby={`${listId}-description`} onOpenAutoFocus={(event) => { event.preventDefault(); searchInput.current?.focus(); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); move(event.key === "ArrowDown" ? 1 : -1); }
      }}>
        <div className="group-dm-dialog-header">
          <div>
            <Dialog.Title className="group-dm-dialog-title">Find or start a conversation</Dialog.Title>
            <Dialog.Description id={`${listId}-description`} className="group-dm-dialog-subtitle">Search conversations and friends by name or full username.</Dialog.Description>
          </div>
          <Dialog.Close asChild><button className="icon-button" disabled={selecting} aria-label="Close conversation search"><X size={18} /></button></Dialog.Close>
        </div>
        <div className="group-dm-search-wrap">
          <Search size={16} aria-hidden="true" />
          <input ref={searchInput} className="group-dm-search-input" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls={listId} aria-activedescendant={activeIndex >= 0 ? `${listId}-${matching[activeIndex]!.key}` : undefined} aria-label="Search conversations and friends" placeholder="Search conversations and friends" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedIndex(0); }} onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); void select(activeIndex); }
          }} />
        </div>
        {(conversations.isPending || friends.isPending) && <ApiNotice loading="Loading conversations and friends?" />}
        {conversations.error && <ApiNotice error={conversations.error} onRetry={() => void conversations.refetch()} />}
        {friends.error && <ApiNotice error={friends.error} onRetry={() => void friends.refetch()} />}
        <div ref={resultList} id={listId} role="listbox" className="group-dm-friends-list" aria-label="Conversation results" aria-busy={selecting}>
          {matching.map((item, index) => <button id={`${listId}-${item.key}`} key={item.key} type="button" role="option" aria-selected={index === activeIndex} className={`group-dm-friend-row${index === activeIndex ? " is-selected" : ""}`} disabled={selecting} onMouseEnter={() => setSelectedIndex(index)} onFocus={() => setSelectedIndex(index)} onClick={() => void select(index)}>
            {item.group ? <span className="conversation-search-group-avatar"><Users size={20} aria-hidden="true" /></span> : <UserAvatar user={{ name: item.name, email: "", image: item.avatar }} className="size-9 shrink-0" />}
            <span className="group-dm-friend-info"><span className="group-dm-friend-name">{item.name}</span><span className="group-dm-friend-tag">{item.handles}</span></span>
          </button>)}
          {!matching.length && !conversations.isPending && !friends.isPending && <p className="group-dm-empty">No matching conversations or friends.</p>}
        </div>
        {friends.hasNextPage && <Button className="m-3 shrink-0" variant="ghost" disabled={friends.isFetchingNextPage} onClick={() => void friends.fetchNextPage()}>Load more friends</Button>}
        {opener.error && <ApiNotice error={opener.error} />}
      </ModalContent>
    </Dialog.Portal>
  </Dialog.Root>;
}
