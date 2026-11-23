import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Lock, Plus, Slash, Trash2, X } from "lucide-react";
import { useAppData } from "@/app/app-data-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiNotice } from "@/components/common/ApiNotice";
import { queryKeys } from "@/features/community/api/hooks";
import { categoryQueryKeys } from "@/features/community/categories/api";
import { ApiError, apiErrorMessage } from "@/lib/api/errors";

type Target = { kind: "role" | "member"; id: string };
type Entry = Target & { permission: string; state: boolean | null };
interface Snapshot { children?: {id:string;name:string;synced:boolean}[]; version: string; resource: { name: string; kind?: string; category_id?: string; category_name?: string; sync_with_category?: boolean; is_private?: boolean }; entries: Entry[]; roles: {id:string;name:string;color:string|null;is_default:boolean}[]; members:{id:string;name:string;username:string;avatar_url:string|null}[] }
const permissions = [
  ["General Channel Permissions", "channels.view", "View Channel", "View this channel and its message history."],
  ["General Channel Permissions", "channels.manage", "Manage Channel", "Edit, duplicate, or delete this channel."],
  ["General Channel Permissions", "roles.manage", "Manage Permissions", "Configure permission overrides, subject to role hierarchy."],
  ["Text Channel Permissions", "messages.send", "Send Messages", "Send messages in this channel."],
] as const;
const same = (a:Target,b:Target) => a.kind===b.kind && a.id===b.id;
export function PermissionsEditor({communityId,resourceId,kind="channels"}:{communityId:string;resourceId:string;kind?:"channels"|"categories"}) {
  const {api,ready}=useAppData();
  const key=["permission-overwrites",communityId,kind,resourceId];
  const path=`/communities/${communityId}/permission-resources/${kind}/${resourceId}`;
  const query=useQuery({queryKey:key,queryFn:async({signal})=>{ const data=await api.get<Snapshot>(path,{signal}); if(!data || typeof data.version!=="string" || !data.resource || !Array.isArray(data.roles) || !Array.isArray(data.members) || !Array.isArray(data.entries))throw new ApiError("invalid_response"); return data; },enabled:ready,retry:false,refetchOnWindowFocus:false});
  if(query.isError)return <ApiNotice error={query.error} onRetry={()=>{void query.refetch();}} />;
  if(!query.data)return <p role="status">Loading permission overrides...</p>;
  return <Editor key={`${kind}:${resourceId}`} snapshot={query.data} communityId={communityId} resourceId={resourceId} kind={kind} path={path} />;
}
function Editor({snapshot,communityId,resourceId,kind,path}:{snapshot:Snapshot;communityId:string;resourceId:string;kind:string;path:string}) {
  const {api}=useAppData(); const queries=useQueryClient();
  const everyone=snapshot.roles.find(r=>r.is_default);
  const [entries,setEntries]=useState(snapshot.entries);
  const [targets,setTargets]=useState<Target[]>(()=>[...(everyone?[{kind:"role" as const,id:everyone.id}]:[]),...snapshot.entries.filter((e,i,all)=>!all.slice(0,i).some(t=>same(t,e)) && e.id!==everyone?.id).map(({kind,id})=>({kind,id}))]);
  const [selected,setSelected]=useState<Target|undefined>(targets[0]);
  const [search,setSearch]=useState(""); const [targetSearch,setTargetSearch]=useState("");
  const [tab,setTab]=useState<"role"|"member">("role"); const [picker,setPicker]=useState(false); const [confirmSync,setConfirmSync]=useState(false);
  const dirty=JSON.stringify(entries)!==JSON.stringify(snapshot.entries);
  const mutation=useMutation({mutationFn:({sync=false}:{sync?:boolean})=>{
    const changed:Entry[]=[];
    for(const entry of [...snapshot.entries,...entries])if(!changed.some(e=>same(e,entry)&&e.permission===entry.permission))changed.push({...entry,state:entries.find(e=>same(e,entry)&&e.permission===entry.permission)?.state??null});
    return api.put<Snapshot>(path,{version:snapshot.version,changes:sync?[]:changed.filter(e=>(snapshot.entries.find(old=>same(old,e)&&old.permission===e.permission)?.state??null)!==e.state).map(e=>({...e})),sync});
  },onSuccess:(result)=>{
    setEntries(result.entries);
    queries.setQueryData(["permission-overwrites",communityId,kind,resourceId],result);
    void queries.invalidateQueries({queryKey:["permission-overwrites",communityId]});
    void queries.invalidateQueries({queryKey:queryKeys.channels(communityId)});
    void queries.invalidateQueries({queryKey:queryKeys.channelAccess(communityId)});
    void queries.invalidateQueries({queryKey:categoryQueryKeys.categories(communityId)});
    setConfirmSync(false);
  }});
  function setState(target:Target,permission:string,state:boolean|null){setEntries(prev=>[...prev.filter(e=>!(same(e,target)&&e.permission===permission)),...(state===null?[]:[{...target,permission,state}])]);}
  const label=(t:Target)=>t.kind==="role"?snapshot.roles.find(r=>r.id===t.id)?.name:snapshot.members.find(m=>m.id===t.id)?.name;
  const dot=(t:Target)=>t.kind==="role"?<span className="permission-role-dot" style={{background:snapshot.roles.find(r=>r.id===t.id)?.color??"var(--muted-foreground)"}} />:snapshot.members.find(m=>m.id===t.id)?.avatar_url?<img className="permission-member-avatar" src={snapshot.members.find(m=>m.id===t.id)!.avatar_url!} alt="" />:<span className="permission-member-avatar" aria-hidden="true">{label(t)?.slice(0,1)}</span>;
  const privateChannel=entries.some(e=>e.kind==="role"&&e.id===everyone?.id&&e.permission==="channels.view"&&e.state===false);
  return <div className="permission-editor">
    <h2 className="text-lg font-semibold">{kind==="categories"?"Category Permissions":"Channel Permissions"}</h2><p className="text-sm text-muted-foreground">Customize which roles and members can access this {kind==="categories"?"category":"channel"} and what actions they can perform.</p>
    {kind==="channels"&&snapshot.resource.category_id&&<div className="permission-sync"><span>{snapshot.resource.sync_with_category&&!dirty?`Permissions synced with category: ${snapshot.resource.category_name ?? snapshot.resource.category_id}`:"Permissions not synced with category"}</span><Button variant="outline" disabled={mutation.isPending} onClick={()=>setConfirmSync(true)}>Sync permissions</Button></div>}
    {kind==="categories"&&Boolean(snapshot.children?.length)&&<section aria-label="Child channel synchronization"><h3>Channel synchronization</h3><ul className="text-xs text-muted-foreground">{snapshot.children?.map(c=><li key={c.id}>#{c.name}: {c.synced?"Synced":"Independent overrides"}</li>)}</ul></section>}
    <div className="permission-private"><Lock aria-hidden="true" /><div><strong>Private Channel</strong><p>Only selected roles and members can view it. Owners and Administrators retain access.</p></div><button type="button" role="switch" aria-label="Private Channel" aria-checked={privateChannel} disabled={!everyone||mutation.isPending} onClick={()=>{if(everyone)setState({kind:"role",id:everyone.id},"channels.view",privateChannel?null:false);}} className="permission-switch"><span /></button></div>
    {privateChannel&&<section aria-label="Who can access this channel?"><h3>Who can access this channel?</h3><p className="text-xs text-muted-foreground">Explicit View Channel grants; effective access also depends on other roles and member overrides.</p><div className="permission-access-list">{entries.filter(e=>e.permission==="channels.view"&&e.state===true).map(e=><span key={`${e.kind}:${e.id}`}>{dot(e)}{label(e)}</span>)}</div></section>}
    <h3 className="mt-5 text-xs font-semibold uppercase text-muted-foreground">Advanced Permissions</h3>
    <div className="permission-columns"><aside aria-label="Roles and members">
      <Popover.Root open={picker} onOpenChange={setPicker}><Popover.Trigger asChild><Button variant="outline"><Plus aria-hidden="true" />Add Roles or Members</Button></Popover.Trigger><Popover.Portal><Popover.Content className="core-context-menu permission-target-picker" side="right" collisionPadding={12}>
        <Input aria-label="Search roles or members" value={targetSearch} onChange={e=>setTargetSearch(e.target.value)} placeholder="Search roles or members" />
        <div className="flex gap-2 my-2" role="group" aria-label="Target type"><Button variant={tab==="role"?"default":"ghost"} onClick={()=>setTab("role")}>Roles</Button><Button variant={tab==="member"?"default":"ghost"} onClick={()=>setTab("member")}>Members</Button></div>
        <div className="permission-picker-list">{(tab==="role"?snapshot.roles.filter(r=>!r.is_default).map(r=>({...r,username:""})):snapshot.members).filter(t=>`${t.name} ${t.username}`.toLowerCase().includes(targetSearch.toLowerCase())).map(t=>{
          const target={kind:tab,id:t.id};const exists=targets.some(e=>same(e,target));
          return <button type="button" className="core-context-menu-item" key={t.id} aria-pressed={exists} onClick={()=>{if(!exists)setTargets(prev=>[...prev,target]);setSelected(target);setPicker(false);}}>{dot(target)}<span>{t.name}{t.username&&<small className="block text-muted-foreground">@{t.username}</small>}</span>{exists&&<Check aria-hidden="true" />}</button>;
        })}</div>
      </Popover.Content></Popover.Portal></Popover.Root>
      <ul className="permission-targets">{targets.map(t=><li key={`${t.kind}:${t.id}`}><button type="button" className="permission-target" aria-pressed={selected&&same(selected,t)} onClick={()=>setSelected(t)}>{dot(t)}<span>{label(t)}</span></button>{t.id!==everyone?.id&&<button type="button" className="icon-button" aria-label={`Remove overrides for ${label(t)}`} disabled={mutation.isPending} onClick={()=>{setEntries(prev=>prev.filter(e=>!same(e,t)));setTargets(prev=>prev.filter(e=>!same(e,t)));setSelected(targets[0]);}}><Trash2 size={14} /></button>}</li>)}</ul>
    </aside><section aria-label="Permission overrides">
      <Input aria-label="Search permissions" placeholder="Search permissions" value={search} onChange={e=>setSearch(e.target.value)} />
      {selected&&<p className="my-3 text-sm">Editing {label(selected)}</p>}
      {permissions.filter(p=>snapshot.resource.kind!=="voice"||p[0]!=="Text Channel Permissions").filter(p=>`${p[2]} ${p[3]}`.toLowerCase().includes(search.toLowerCase())).map((p,i,all)=><div key={p[1]}>
        {(i===0||all[i-1]?.[0]!==p[0])&&<h4 className="permission-group">{p[0]}</h4>}
        <div className="permission-row"><div><strong>{p[2]}</strong><p>{p[3]}</p></div><div className="permission-states" role="group" aria-label={p[2]}>{([false,null,true] as const).map((state,index)=>{const value=entries.find(e=>selected&&same(e,selected)&&e.permission===p[1])?.state??null;const text=["Deny","Neutral","Allow"][index]!;return <button key={text} type="button" data-state={text.toLowerCase()} aria-label={`${text} ${p[2]}`} title={state===null?"Neutral: inherit permissions":`${text} for this target`} aria-pressed={value===state} disabled={!selected||mutation.isPending} onClick={()=>{if(selected)setState(selected,p[1],state);}}>{index===0?<X />:index===1?<Slash />:<Check />}</button>;})}</div></div>
      </div>)}
    </section></div>
    {mutation.isError&&<p role="alert" className="text-sm text-destructive">{apiErrorMessage(mutation.error)} Your draft is preserved. Reload if someone else changed permissions.</p>}
    <div className="permission-save"><span className="text-sm text-muted-foreground">{dirty?"You have unsaved changes.":"Changes apply when saved."}</span><Button variant="ghost" disabled={!dirty||mutation.isPending} onClick={()=>setEntries(snapshot.entries)}>Reset</Button><Button disabled={!dirty||mutation.isPending} onClick={()=>mutation.mutate({})}>{mutation.isPending?"Saving...":"Save Changes"}</Button></div>
    <Dialog.Root open={confirmSync} onOpenChange={setConfirmSync}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="standard-dialog"><Dialog.Title>Sync permissions with category?</Dialog.Title><Dialog.Description className="my-4">This replaces independent channel overrides with the category's permissions. Future category changes will apply to this channel.</Dialog.Description><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setConfirmSync(false)}>Cancel</Button><Button disabled={mutation.isPending} onClick={()=>mutation.mutate({sync:true})}>Sync permissions</Button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
