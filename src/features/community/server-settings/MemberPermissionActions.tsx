import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { useAppData } from "@/app/app-data-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/api/errors";
import type { ServerMember } from "@/lib/api/types";
import type { ServerSettingsData } from "./types";

export function MemberPermissionActions({ settings, member, currentUserId }: {
  settings: ServerSettingsData; member: ServerMember; currentUserId: string;
}) {
  const { api } = useAppData();
  const queries = useQueryClient();
  const [action, setAction] = useState<"nickname" | "timeout" | null>(null);
  const [nickname, setNickname] = useState(member.nickname ?? "");
  const [duration, setDuration] = useState("600");
  const [reason, setReason] = useState("");
  const grants = settings.permissions.effective_permissions ?? [];
  const self = member.id === currentUserId;
  const owner = member.id === settings.owner_id;
  const canNickname = (self || !owner) && grants.includes(self ? "nicknames.change" : "nicknames.manage");
  const canTimeout = !self && !owner && grants.includes("members.moderate");
  const save = useMutation({
    mutationFn: () => api.patch(`/communities/${settings.id}/members/${member.id}/${action}`, action === "nickname"
      ? { nickname: nickname.trim() || null }
      : { duration_seconds: duration === "remove" ? null : Number(duration), reason: reason.trim() || null }),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ["members", settings.id] });
      void queries.invalidateQueries({ queryKey: ["community-members", settings.id] });
      void queries.invalidateQueries({ queryKey: ["channels", settings.id] });
      setAction(null);
    },
  });
  if (!canNickname && !canTimeout) return null;
  return <>
    {canNickname && <Button variant="ghost" size="sm" onClick={() => { save.reset(); setNickname(member.nickname ?? ""); setAction("nickname"); }}>Nickname</Button>}
    {canTimeout && <Button variant="ghost" size="sm" onClick={() => { save.reset(); setAction("timeout"); }}>Timeout</Button>}
    <Dialog.Root open={action !== null} onOpenChange={open => { if (!open && !save.isPending) setAction(null); }}>
      <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="standard-dialog">
        <Dialog.Title>{action === "nickname" ? "Change server nickname" : "Timeout member"}</Dialog.Title>
        <Dialog.Description className="my-3 text-sm text-muted-foreground">{member.display_name}: {action === "nickname" ? "This only changes their name in this server." : "Temporarily restrict server interactions. The restriction expires automatically. Role hierarchy applies."}</Dialog.Description>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
          {action === "nickname" ? <label className="block text-sm">Nickname<Input autoFocus maxLength={32} value={nickname} onChange={event => setNickname(event.target.value)} placeholder="Use global display name" /></label> : <>
            <label className="block text-sm">Duration<select className="block w-full rounded border border-border bg-background p-2" value={duration} onChange={event => setDuration(event.target.value)}>
              <option value="60">1 minute</option><option value="600">10 minutes</option><option value="3600">1 hour</option><option value="86400">1 day</option><option value="604800">1 week</option><option value="2419200">28 days</option><option value="remove">Remove timeout</option>
            </select></label>
            <label className="block text-sm">Reason (optional)<Input maxLength={512} value={reason} onChange={event => setReason(event.target.value)} /></label>
          </>}
          {save.isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(save.error)} Your draft is preserved.</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={save.isPending} onClick={() => setAction(null)}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></div>
        </form>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </>;
}
