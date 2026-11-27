import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Check, CornerUpRight, Hash, MessageSquare, Search, Users, X } from "lucide-react";
import { useAppData } from "@/app/app-data-context";
import { Button } from "@/components/ui/button";
import { queryKeys, useCommunities, useCurrentUser } from "@/features/community/api/hooks";
import { mergeConfirmedMessage } from "@/features/community/api/message-cache";
import type { ChatMessageData } from "@/features/community/types";
import { conversationQueryKeys, useConversations } from "@/features/conversations/api";
import { plainMessageText } from "@/features/mentions/model";
import { endpoints } from "@/lib/api/endpoints";
import { apiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

export interface ForwardDestination {
  kind: "channel" | "conversation";
  id: string;
  label: string;
  sublabel: string;
  searchText: string;
  icon: "channel" | "direct" | "group";
}

export function ForwardMessageDialog({
  open,
  onClose,
  message,
  sourceKind,
  sourceId,
  onForwarded,
}: {
  open: boolean;
  onClose: () => void;
  message: ChatMessageData;
  sourceKind: "channel" | "conversation" | "thread";
  sourceId: string;
  onForwarded?: (destination: ForwardDestination) => void;
}) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  const profile = useCurrentUser();
  const communities = useCommunities();
  const conversations = useConversations();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ForwardDestination | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nonceRef = useRef<string>(crypto.randomUUID());

  // Reset nonce when target destination or message changes
  useEffect(() => {
    nonceRef.current = crypto.randomUUID();
  }, [message.id, selected?.id, selected?.kind, comment]);

  // Fetch channels for all communities the user belongs to
  const communityList = useMemo(() => communities.data ?? [], [communities.data]);
  const channelQueries = useQueries({
    queries: communityList.map((comm) => ({
      queryKey: queryKeys.channels(comm.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => endpoints.channels(api, comm.id, signal),
      enabled: open && ready,
      staleTime: 15_000,
    })),
  });

  const destinations = useMemo<ForwardDestination[]>(() => {
    const items: ForwardDestination[] = [];
    const currentUserId = profile.data?.id;

    // 1. Direct messages and Group DMs
    for (const conv of conversations.data ?? []) {
      const isGroup = conv.type === "group";
      const otherMembers = conv.members.filter((m) => m.profile.id !== currentUserId);
      const participantNames = conv.members
        .map((m) => `${m.profile.display_name} ${m.profile.username}`)
        .join(" ");
      const label = isGroup
        ? conv.name ||
          conv.members
            .map((m) => m.profile.display_name)
            .slice(0, 3)
            .join(", ")
        : otherMembers[0]?.profile.display_name ??
          conv.members[0]?.profile.display_name ??
          "Direct Message";
      const sublabel = isGroup
        ? `${conv.members.length} members`
        : `@${otherMembers[0]?.profile.username ?? conv.members[0]?.profile.username ?? ""}`;

      items.push({
        kind: "conversation",
        id: conv.id,
        label,
        sublabel,
        searchText: `${label} ${sublabel} ${participantNames}`.toLowerCase(),
        icon: isGroup ? "group" : "direct",
      });
    }

    // 2. Server text channels where can_send_messages !== false
    communityList.forEach((comm, index) => {
      const chList = channelQueries[index]?.data ?? [];
      for (const ch of chList) {
        if (ch.kind === "voice" || ch.can_send_messages === false) continue;
        items.push({
          kind: "channel",
          id: ch.id,
          label: `# ${ch.name}`,
          sublabel: comm.name,
          searchText: `${ch.name} ${comm.name}`.toLowerCase(),
          icon: "channel",
        });
      }
    });

    return items;
  }, [channelQueries, communityList, conversations.data, profile.data?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return destinations;
    return destinations.filter((d) => d.searchText.includes(term));
  }, [destinations, search]);

  const previewText =
    plainMessageText(message.body, message.mentions) ||
    message.forwarded?.body ||
    (message.attachments?.length ? `${message.attachments.length} attachment(s)` : "");

  async function handleForward() {
    if (!selected || submitting || !ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const forwardedMsg = await endpoints.forwardMessage(api, {
        source_kind: sourceKind,
        source_id: sourceId,
        message_id: message.id,
        destination_kind: selected.kind,
        destination_id: selected.id,
        client_nonce: nonceRef.current,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });

      const cacheKey =
        selected.kind === "channel"
          ? queryKeys.messages(selected.id)
          : conversationQueryKeys.messages(selected.id);

      queries.setQueryData(
        cacheKey,
        (previous: Parameters<typeof mergeConfirmedMessage>[0]) =>
          mergeConfirmedMessage(previous, forwardedMsg),
      );
      void queries.invalidateQueries({ queryKey: cacheKey });
      if (selected.kind === "conversation") {
        void queries.invalidateQueries({ queryKey: conversationQueryKeys.conversations });
      }

      onForwarded?.(selected);
      onClose();
    } catch (failure) {
      setError(apiErrorMessage(failure));
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !submitting) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="standard-dialog forward-message-dialog p-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
              <CornerUpRight className="size-4 text-primary" />
              Forward Message
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button"
                disabled={submitting}
                aria-label="Close forward dialog"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Choose a channel or conversation to forward this message to.
          </Dialog.Description>

          <div className="my-3 p-3 rounded-md bg-secondary/70 border border-border text-xs">
            <div className="font-semibold text-foreground mb-1">{message.author.name}</div>
            <div className="text-muted-foreground line-clamp-2">{previewText}</div>
          </div>

          <div className="space-y-3">
            <label className="forward-search-box flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                type="search"
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Search conversations or channels"
                aria-label="Search conversations or channels"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </label>

            <div
              className="forward-destination-list max-h-56 overflow-y-auto space-y-1 pr-1"
              role="listbox"
              aria-label="Destinations"
            >
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No matching destinations found.
                </p>
              ) : (
                filtered.map((dest) => {
                  const isSelected =
                    selected?.kind === dest.kind && selected?.id === dest.id;
                  return (
                    <button
                      key={`${dest.kind}-${dest.id}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "forward-destination-option w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors",
                        isSelected
                          ? "bg-primary/20 border border-primary/50 text-foreground"
                          : "hover:bg-accent/60 text-foreground",
                      )}
                      onClick={() => setSelected(dest)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {dest.icon === "channel" ? (
                          <Hash className="size-4 text-muted-foreground shrink-0" />
                        ) : dest.icon === "group" ? (
                          <Users className="size-4 text-muted-foreground shrink-0" />
                        ) : (
                          <MessageSquare className="size-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{dest.label}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {dest.sublabel}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check className="size-4 text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            <div>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm outline-none"
                placeholder="Add an optional comment…"
                aria-label="Optional comment"
                maxLength={4000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selected || submitting}
              onClick={() => void handleForward()}
            >
              {submitting ? "Forwarding…" : "Forward"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
