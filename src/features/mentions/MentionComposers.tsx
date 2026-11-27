import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { useMembers } from "@/features/community/api/hooks";
import { MessageComposer } from "@/features/community/components/MessageComposer";
import { parseList, record, string, uuid } from "@/lib/api/contracts";
import { ApiError } from "@/lib/api/errors";
import type { MessageReplyReference, PublicProfile } from "@/lib/api/types";
import type { Mention, MentionSuggestion } from "./model";

function useSearch() {
  const [search, setSearch] = useState<string | null>(null);
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => { const timer = setTimeout(() => setSettled(search), 180); return () => clearTimeout(timer); }, [search]);
  return { search, setSearch, settled };
}
function userSuggestion(profile: PublicProfile): MentionSuggestion {
  return { kind: "user", id: profile.id, label: profile.display_name, detail: `${profile.username}${profile.discriminator ? `#${profile.discriminator}` : ""}`, profile };
}
interface Props {
  channelName: string;
  placeholder?: string;
  autoFocus?: boolean;
  canSendMessages?: boolean;
  disabledReason?: string;
  initialBody?: string;
  initialMentions?: Mention[];
  submitLabel?: string;
  replyTo?: MessageReplyReference | null;
  replyMention?: boolean;
  onToggleReplyMention?: (enabled: boolean) => void;
  onCancelReply?: () => void;
  onSend: (body: string, mentions?: Mention[]) => void | Promise<void>;
}
export function ChannelMentionComposer({ communityId, channelId, ...props }: Props & { communityId: string; channelId: string }) {
  const { api, ready } = useAppData();
  const { search, setSearch, settled } = useSearch();
  const enabled = props.canSendMessages !== false && search !== null && search === settled;
  const members = useMembers(communityId, channelId, settled ?? "", enabled);
  const roles = useQuery({
    queryKey: ["mention-roles", channelId, settled],
    queryFn: async ({ signal }) => parseList(await api.get(`/channels/${channelId}/mention-roles`, { signal, query: { search: settled ?? "" } }), (value): MentionSuggestion => {
      const item = record(value);
      const kind = string(item.kind);
      if (kind !== "role" && kind !== "everyone" && kind !== "here") throw new ApiError("invalid_response");
      return { kind, ...(kind === "role" ? { id: uuid(item.id) } : {}), label: string(item.label), color: typeof item.color === "string" && /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : null };
    }), enabled: ready && enabled, staleTime: 10_000,
  });
  const suggestions: MentionSuggestion[] = enabled ? [
    ...(roles.data ?? []),
    ...(members.data?.pages.flatMap((page) => page.items).slice(0, 25).map((member) => ({ ...userSuggestion(member), label: member.nickname || member.display_name, color: member.roles.find((role) => role.color)?.color })) ?? []),
  ] : [];
  return <MessageComposer {...props} communityId={communityId} onMentionSearch={setSearch} mentionSuggestions={suggestions} mentionsLoading={search !== settled || members.isFetching || roles.isFetching} />;
}
export function ConversationMentionComposer({ participants, ...props }: Props & { participants: PublicProfile[] }) {
  const [search, setSearch] = useState<string | null>(null);
  const term = search?.toLocaleLowerCase() ?? "";
  const suggestions = participants.filter((p) => `${p.display_name} ${p.username}#${p.discriminator ?? ""}`.toLocaleLowerCase().includes(term)).slice(0, 50).map(userSuggestion);
  return <MessageComposer {...props} onMentionSearch={setSearch} mentionSuggestions={suggestions} />;
}
