import { useOpenConversation } from "@/features/conversations/use-open-conversation";
import { apiErrorMessage } from "@/lib/api/errors";
import { useCurrentUser } from "@/features/community/api/hooks";

export function ConversationProfileName({ id, name }: { id: string; name: string }) {
  const conversation = useOpenConversation();
  const me = useCurrentUser();
  if (me.data?.id === id) return name;
  return <>
    <button type="button" className="cursor-pointer rounded hover:underline focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Open conversation with ${name}`} disabled={conversation.isPending} onClick={() => { void conversation.openDirect(id).catch(() => {}); }}>{name}</button>
    {conversation.error && <span role="alert" className="block text-xs font-normal text-destructive">{apiErrorMessage(conversation.error)}</span>}
  </>;
}
