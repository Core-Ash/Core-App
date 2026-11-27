import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { Button } from "@/components/ui/button";
import type { ChatMessageData } from "@/features/community/types";
import type { PublicProfile } from "@/lib/api/types";
import { apiErrorMessage } from "@/lib/api/errors";
import { parseMessage } from "@/lib/api/contracts";
import { ChannelMentionComposer, ConversationMentionComposer } from "./MentionComposers";
import { mentionPayload, type Mention } from "./model";

export type MentionContext = { kind: "channel"; id: string; name: string; communityId: string } | { kind: "conversation"; id: string; name: string; participants: PublicProfile[] };

// One implementation of edit/delete for server channels, DMs and group DMs.
function useMessageMutations(message: ChatMessageData, context: MentionContext) {
  const { api } = useAppData();
  const queries = useQueryClient();
  const path = `/${context.kind === "channel" ? "channels" : "conversations"}/${context.id}/messages/${message.id}`;
  const refresh = () => queries.invalidateQueries({ queryKey: [context.kind === "channel" ? "messages" : "conversation-messages", context.id] });
  return {
    async save(body: string, mentions: Mention[] = []) {
      parseMessage(await api.patch(path, { body, mentions: mentionPayload(mentions) }));
      await refresh();
    },
    async remove() {
      parseMessage(await api.delete(path));
      await refresh();
    },
  };
}

export function InlineMessageEditor({ message, context, onClose }: { message: ChatMessageData; context: MentionContext; onClose: () => void }) {
  const { save } = useMessageMutations(message, context);
  async function submit(body: string, mentions: Mention[] = []) {
    await save(body, mentions);
    onClose();
  }
  const shared = { key: message.id, autoFocus: true, submitLabel: "Save changes", channelName: context.name, initialBody: message.body, initialMentions: message.mentions, onSend: submit };
  return (
    <div className="message-inline-editor" onKeyDown={(event) => { if (event.key === "Escape" && !event.defaultPrevented) { event.stopPropagation(); onClose(); } }}>
      {context.kind === "channel"
        ? <ChannelMentionComposer {...shared} communityId={context.communityId} channelId={context.id} />
        : <ConversationMentionComposer {...shared} participants={context.participants} />}
      <p className="message-inline-editor-hint">escape to <button type="button" onClick={onClose}>cancel</button> • enter to save</p>
    </div>
  );
}

export function DeleteMessageDialog({ message, context, onClose }: { message: ChatMessageData; context: MentionContext; onClose: () => void }) {
  const { remove } = useMessageMutations(message, context);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await remove(); onClose(); }
    catch (failure) { setError(apiErrorMessage(failure)); setBusy(false); }
  }
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="standard-dialog p-6">
          <Dialog.Title className="text-xl font-semibold">Delete Message</Dialog.Title>
          <Dialog.Description className="my-4 text-sm text-muted-foreground">Are you sure you want to delete this message? This action cannot be undone.</Dialog.Description>
          {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="button" className="bg-destructive hover:bg-destructive/90" disabled={busy} onClick={() => void confirm()}>{busy ? "Deleting…" : "Delete"}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
