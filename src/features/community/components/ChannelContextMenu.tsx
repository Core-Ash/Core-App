import { useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router";
import { Bell, BellOff, Check, ChevronRight, Copy, Hash, Pencil, RefreshCw, Trash2, Volume2 } from "lucide-react";
import { ApiError, apiErrorMessage } from "@/lib/api/errors";
import { useAppData } from "@/app/app-data-context";
import { queryKeys } from "@/features/community/api/hooks";
import { communityHref } from "@/features/community/api/use-community-selection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Channel } from "@/lib/api/types";

const item = "core-context-menu-item";
export function ChannelContextMenu({ channel, communityId, position, canManage, onDismiss, onEdit, onCreate, returnFocus }: {
  channel: Channel; communityId: string; position: { x: number; y: number }; canManage: boolean;
  onDismiss: () => void; onEdit: () => void; onCreate: () => void; returnFocus: HTMLElement | null;
}) {
  const { api, ready } = useAppData();
  const queries = useQueryClient();
  const navigate = useNavigate();
  const [action, setAction] = useState<"duplicate" | "delete" | null>(null);
  const [name, setName] = useState(`${channel.name.slice(0, 95)}-copy`);
  const key = ["channel-preferences", channel.id];
  type Preferences = { is_muted: boolean; muted_until: string | null; notification_mode: string };
  const preferences = useQuery({ queryKey: key, queryFn: ({ signal }) => api.get<Preferences>(`/channels/${channel.id}/preferences`, { signal }), enabled: ready, retry: false, refetchInterval: (query) => query.state.status === "error" ? false : 15000 });
  const saved = preferences.isError ? undefined : preferences.data;
  const mute = useMutation({
    mutationFn: (value: {is_muted: boolean; duration_minutes?: number; preserve_mute?: boolean; notification_mode: string}) => api.put<Preferences>(`/channels/${channel.id}/preferences`, value),
    onMutate: async (value) => { await queries.cancelQueries({queryKey:key}); const previous=queries.getQueryData<Preferences>(key); const channelsKey=queryKeys.channels(communityId); await queries.cancelQueries({queryKey:channelsKey}); const previousChannels=queries.getQueryData<Channel[]>(channelsKey); queries.setQueryData<Channel[]>(channelsKey,(items)=>items?.map((item)=>item.id===channel.id ? {...item,is_muted:value.is_muted} : item)); queries.setQueryData(key,{...previous,...value}); return {previous,previousChannels}; },
    onError: (_e,_v,ctx) => { queries.setQueryData(key,ctx?.previous); if(ctx?.previousChannels) queries.setQueryData(queryKeys.channels(communityId),ctx.previousChannels); setError(true); },
    onSuccess: (value) => { queries.setQueryData(key,value); setError(false); },
    onSettled: () => { void queries.invalidateQueries({queryKey:key}); void queries.invalidateQueries({queryKey:queryKeys.channels(communityId)}); }
  });
  const operation = useMutation({ mutationFn: async () => {
    if (action === "delete") { await api.delete(`/communities/${communityId}/channels/${channel.id}`); navigate(communityHref(communityId)); }
    else { const created=await api.post<Channel>(`/communities/${communityId}/channels/${channel.id}/duplicate`,{name:name.trim()}); navigate(communityHref(communityId,created.id)); }
  }, onSuccess: () => { void queries.invalidateQueries({queryKey:queryKeys.channels(communityId)}); onDismiss(); } });
  const update = (is_muted: boolean, duration_minutes?: number, notification_mode = saved?.notification_mode ?? "default") => mute.mutate({is_muted,duration_minutes,notification_mode});
  const submenu = "core-context-menu core-context-submenu";
  const [error, setError] = useState(false);
  if (action) return <Dialog.Root open onOpenChange={(open) => { if (!open && !operation.isPending) onDismiss(); }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="standard-dialog">
    <Dialog.Title className="text-xl font-semibold">{action === "delete" ? "Delete Channel" : "Duplicate Channel"}</Dialog.Title>
    <Dialog.Description className="my-4 text-sm text-muted-foreground">{action === "delete" ? `Delete #${channel.name}? This action cannot be undone.` : `Copy ${channel.kind ?? "text"} channel #${channel.name}, its topic, category, and permission overwrites. Messages and personal preferences are excluded.`}</Dialog.Description>
    <form onSubmit={(e) => {e.preventDefault(); if (!operation.isPending) operation.mutate();}}>
      {action === "duplicate" && <><label htmlFor="duplicate-channel-name">Channel name</label><Input id="duplicate-channel-name" value={name} onChange={(e)=>setName(e.target.value)} maxLength={100} required /><p className="my-3 text-sm text-muted-foreground">Topic: {channel.topic || "None"}</p></>}
      {operation.isError && <p role="alert" className="my-3 text-destructive">Could not {action} channel. Check your permissions and try again.</p>}
      <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" disabled={operation.isPending} onClick={onDismiss}>Cancel</Button><Button type="submit" className={action === "delete" ? "bg-destructive hover:bg-destructive/90" : undefined} disabled={operation.isPending}>{operation.isPending ? "Saving..." : action === "delete" ? "Delete Channel" : "Duplicate Channel"}</Button></div>
    </form>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
  return <Menu.Root open onOpenChange={(open) => { if (!open) onDismiss(); }} modal={false}>
    <Menu.Trigger aria-label={`Channel menu for ${channel.name}`} style={{ position: "fixed", left: position.x, top: position.y, width: 0, height: 0 }} />
    <Menu.Portal><Menu.Content aria-label={`Channel menu for ${channel.name}`} align="start" sideOffset={0} collisionPadding={8}
      className="core-context-menu"
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
      onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus?.focus(); }}>
      {saved?.is_muted ? <Menu.Item className={item} disabled={!saved || mute.isPending} onSelect={(e)=>{e.preventDefault();update(false);}}><Bell aria-hidden="true" />Unmute Channel</Menu.Item> : <Menu.Sub><Menu.SubTrigger className={item} disabled={!saved || mute.isPending}><BellOff aria-hidden="true" /><span className="core-context-menu-label">Mute Channel</span><ChevronRight className="core-context-menu-chevron" aria-hidden="true" /></Menu.SubTrigger><Menu.Portal><Menu.SubContent className={submenu} collisionPadding={8} sideOffset={4}>
        {[[15,"For 15 Minutes"],[60,"For 1 Hour"],[180,"For 3 Hours"],[480,"For 8 Hours"],[1440,"For 24 Hours"],[0,"Until I Turn It Back On"]].map(([minutes,label])=><Menu.Item key={minutes} className={item} onSelect={(e)=>{e.preventDefault();update(true,Number(minutes)||undefined);}}>{label}</Menu.Item>)}
      </Menu.SubContent></Menu.Portal></Menu.Sub>}
      <Menu.Sub><Menu.SubTrigger className={item} disabled={!saved || mute.isPending}><Bell aria-hidden="true" /><span className="core-context-menu-label">Notification Settings</span><ChevronRight className="core-context-menu-chevron" aria-hidden="true" /></Menu.SubTrigger><Menu.Portal><Menu.SubContent className={submenu} collisionPadding={8} sideOffset={4}><Menu.RadioGroup value={saved?.notification_mode} onValueChange={(value)=>mute.mutate({is_muted:saved?.is_muted ?? false,notification_mode:value,preserve_mute:true})}>
      {[["all","All Messages"],["mentions","Only @mentions"],["nothing","Nothing"],["default","Use Server Default"]].map(([value,label])=><Menu.RadioItem key={value} value={value!} className={item}><span className="core-context-menu-check"><Menu.ItemIndicator><Check aria-hidden="true" /></Menu.ItemIndicator></span>{label}</Menu.RadioItem>)}
      </Menu.RadioGroup></Menu.SubContent></Menu.Portal></Menu.Sub>
      {preferences.isError && <div className="core-context-menu-error" role="alert"><p>{preferences.error instanceof ApiError && preferences.error.status === 404 ? "Channel preferences are unavailable on this backend." : preferences.error instanceof ApiError && preferences.error.status === 403 ? "You no longer have access to channel preferences." : "Could not load preferences."}</p><button type="button" onClick={() => { void preferences.refetch(); }} disabled={preferences.isFetching}><RefreshCw aria-hidden="true" />{preferences.isFetching ? "Retrying..." : "Retry"}</button></div>}
      {preferences.isPending && <p role="status" className="core-context-menu-status">Loading preferences...</p>}
      {error && <p role="alert" className="px-2.5 py-1 text-xs text-destructive">{apiErrorMessage(mute.error)}</p>}
      {(canManage || channel.can_manage_channel || channel.can_manage_permissions) && <><Menu.Separator className="core-context-menu-separator" />
        <Menu.Item className={item} onSelect={onEdit}><Pencil aria-hidden="true" />Edit Channel</Menu.Item>
        {(canManage || channel.can_manage_channel) && <>
          <Menu.Item className={item} onSelect={(e)=>{e.preventDefault();setAction("duplicate");}}><Copy aria-hidden="true" />Duplicate Channel</Menu.Item>
          {canManage && <Menu.Item className={item} onSelect={onCreate}>{channel.kind === "voice" ? <Volume2 aria-hidden="true" /> : <Hash aria-hidden="true" />}Create {channel.kind === "voice" ? "Voice" : "Text"} Channel</Menu.Item>}
          <Menu.Separator className="core-context-menu-separator" /><Menu.Item className={item} data-tone="danger" onSelect={(e)=>{e.preventDefault();setAction("delete");}}><Trash2 aria-hidden="true" />Delete Channel</Menu.Item>
        </>}
      </>}
    </Menu.Content></Menu.Portal>
  </Menu.Root>;
}
