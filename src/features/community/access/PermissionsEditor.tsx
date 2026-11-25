import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Lock, Plus, Search, Slash, Trash2, X } from "lucide-react";
import { useAppData } from "@/app/app-data-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiNotice } from "@/components/common/ApiNotice";
import { queryKeys } from "@/features/community/api/hooks";
import { categoryQueryKeys } from "@/features/community/categories/api";
import { channelPermissions, matchesPermission, permissionAvailability } from "@/features/community/permissions/registry";
import { ApiError, apiErrorMessage } from "@/lib/api/errors";
import { parsePermissionSnapshot, permissionChanges, sameTarget, snapshotTargets, targetKey, type PermissionEntry, type PermissionSnapshot, type PermissionTarget } from "./permission-model";

interface Props { communityId: string; resourceId: string; kind?: "channels" | "categories"; onDirtyChange?: (dirty: boolean) => void }
export function PermissionsEditor({ communityId, resourceId, kind = "channels", onDirtyChange }: Props) {
  const { api, ready } = useAppData();
  const path = `/communities/${communityId}/permission-resources/${kind}/${resourceId}`;
  const query = useQuery({ queryKey: ["permission-overwrites", communityId, kind, resourceId], queryFn: async ({ signal }) => parsePermissionSnapshot(await api.get(path, { signal })), enabled: ready, retry: false, refetchOnWindowFocus: false });
  if (query.isError) return <ApiNotice error={query.error} onRetry={() => { void query.refetch(); }} />;
  if (!query.data) return <p role="status">Loading permission overrides...</p>;
  return <Editor key={`${communityId}:${kind}:${resourceId}`} remote={query.data} communityId={communityId} resourceId={resourceId} kind={kind} path={path} onDirtyChange={onDirtyChange} />;
}

function Editor({ remote, communityId, resourceId, kind, path, onDirtyChange }: Required<Pick<Props, "communityId" | "resourceId" | "kind">> & { remote: PermissionSnapshot; path: string; onDirtyChange?: Props["onDirtyChange"] }) {
  const { api } = useAppData();
  const queries = useQueryClient();
  const id = useId();
  // A draft edits one pinned server revision, even when another query refreshes.
  const [base, setBase] = useState(remote);
  const [entries, setEntries] = useState(base.entries);
  const [targets, setTargets] = useState(() => snapshotTargets(base));
  const [selected, setSelected] = useState<PermissionTarget | undefined>(targets[0]);
  const [search, setSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [pickerTab, setPickerTab] = useState<"role" | "member">("role");
  const [picker, setPicker] = useState(false);
  const [confirmation, setConfirmation] = useState<"sync" | "clear" | "reload" | null>(null);
  const saving = useRef(false);
  const everyone = base.roles.find(r => r.is_default);
  const applicable = channelPermissions(kind === "categories" ? "category" : base.resource.kind ?? "text");
  const filtered = applicable.filter(p => matchesPermission(p, search));
  const dirty = permissionChanges(base.entries, entries).length > 0;
  const remoteChanged = remote.version !== base.version;
  const rolesAndMembers = [...base.roles.map(r => ({ ...r, kind: "role" as const, username: "", avatar_url: null })), ...base.members.map(m => ({ ...m, kind: "member" as const, color: null, is_default: false }))];
  const targetData = (target: PermissionTarget) => rolesAndMembers.find(t => sameTarget(t, target));
  const label = (target: PermissionTarget) => targetData(target)?.name ?? `Unknown ${target.kind}`;
  const manageable = (target: PermissionTarget | undefined) => Boolean(target && targetData(target)?.manageable);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const mutation = useMutation({
    mutationFn: async ({ revision, draft, sync }: { revision: PermissionSnapshot; draft: PermissionEntry[]; sync: boolean }) => parsePermissionSnapshot(await api.put(path, { version: revision.version, changes: sync ? [] : permissionChanges(revision.entries, draft), sync })),
    onSuccess: result => {
      setBase(result); setEntries(result.entries);
      queries.setQueryData(["permission-overwrites", communityId, kind, resourceId], result);
      for (const key of [["permission-overwrites", communityId], queryKeys.channels(communityId), queryKeys.channelAccess(communityId), categoryQueryKeys.categories(communityId), ["invite-permissions", communityId]]) void queries.invalidateQueries({ queryKey: key });
      setConfirmation(null);
    }, onError: error => {
      if (error instanceof ApiError && ["conflict", "forbidden"].includes(error.kind)) void queries.invalidateQueries({ queryKey: ["permission-overwrites", communityId, kind, resourceId], exact: true });
    }, onSettled: () => { saving.current = false; },
  });
  function save(sync = false) {
    if (saving.current) return;
    saving.current = true;
    mutation.mutate({ revision: base, draft: entries, sync });
  }
  function setState(target: PermissionTarget, permission: string, state: boolean | null) {
    if (saving.current || !manageable(target)) return;
    setEntries(previous => [...previous.filter(e => !(sameTarget(e, target) && e.permission === permission)), ...(state === null ? [] : [{ ...target, permission, state }])]);
  }
  function restore(snapshot: PermissionSnapshot) {
    if (saving.current) return;
    setBase(snapshot); setEntries(snapshot.entries);
    const restored = snapshotTargets(snapshot);
    setTargets(restored);
    if (!selected || !restored.some(t => sameTarget(t, selected))) setSelected(restored[0]);
    setConfirmation(null); mutation.reset();
  }
  function avatar(target: PermissionTarget) {
    const data = targetData(target);
    return target.kind === "role" ? <span className="permission-role-dot" style={{ background: data?.color ?? "var(--muted-foreground)" }} />
      : data?.avatar_url ? <img className="permission-member-avatar" src={data.avatar_url} alt="" referrerPolicy="no-referrer" />
        : <span className="permission-member-avatar" aria-hidden="true">{label(target).slice(0, 1)}</span>;
  }
  const privateChannel = entries.some(e => e.kind === "role" && e.id === everyone?.id && e.permission === "channels.view" && e.state === false);
  const candidates = rolesAndMembers.filter(t => t.kind === pickerTab && !t.is_default && `${t.name} ${t.username}`.toLowerCase().includes(targetSearch.trim().toLowerCase()));
  const canClear = selected && entries.some(e => sameTarget(e, selected) && applicable.some(p => p.key === e.permission));

  return <div className="permission-editor" aria-busy={mutation.isPending}>
    <h2 className="text-lg font-semibold">{kind === "categories" ? "Category Permissions" : "Channel Permissions"}</h2>
    <p className="mb-4 text-sm text-muted-foreground">Choose which roles and members can access this {kind === "categories" ? "category" : "channel"} and what they can do.</p>
    {remoteChanged && <div className="permission-revision-notice" role="status">Permissions changed elsewhere. Your draft is preserved.<Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => dirty ? setConfirmation("reload") : restore(remote)}>Load latest permissions</Button></div>}
    {kind === "channels" && base.resource.category_id && <div className="permission-sync"><span>{base.resource.sync_with_category && !dirty ? `Permissions synced with category: ${base.resource.category_name ?? "category"}` : "Permissions not synced with category"}</span><Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => setConfirmation("sync")}>Sync permissions</Button></div>}
    {kind === "categories" && Boolean(base.children?.length) && <details className="permission-child-sync"><summary>Child channel synchronization</summary><ul>{base.children?.map(c => <li key={c.id}>#{c.name}: {c.synced ? "Synced" : "Independent overrides"}</li>)}</ul></details>}
    <div className="permission-private"><Lock aria-hidden="true" /><div><strong>{kind === "categories" ? "Private Category" : "Private Channel"}</strong><p>Deny View Channel for @everyone. Owners and Administrators retain access.</p></div><button type="button" role="switch" aria-label={kind === "categories" ? "Private Category" : "Private Channel"} aria-checked={privateChannel} disabled={!everyone || !manageable({ kind: "role", id: everyone.id }) || mutation.isPending} onClick={() => { if (everyone) setState({ kind: "role", id: everyone.id }, "channels.view", privateChannel ? null : false); }} className="permission-switch"><span /></button></div>
    {privateChannel && <section className="mb-5" aria-label="Who can access this channel?"><h3 className="text-sm font-medium">Who can access this channel?</h3><p className="mb-2 text-xs text-muted-foreground">Add a role or member, then allow View Channel. Other permissions keep their existing grants.</p><div className="permission-access-list">{entries.filter(e => e.permission === "channels.view" && e.state === true).map(e => <span key={targetKey(e)}>{avatar(e)}{label(e)}</span>)}</div></section>}
    <h3 className="permission-advanced-heading">Advanced Permissions</h3>
    <div className="permission-columns"><aside aria-label="Roles and members">
      <div className="permission-selector-heading"><span>Roles / Members</span><Popover.Root open={picker} onOpenChange={setPicker}>
        <Popover.Trigger asChild><button type="button" className="icon-button" aria-label="Add Roles or Members" disabled={mutation.isPending}><Plus size={17} aria-hidden="true" /></button></Popover.Trigger>
        <Popover.Portal><Popover.Content className="core-context-menu permission-target-picker" side="right" collisionPadding={12} aria-label="Add roles or members">
          <Input aria-label="Search roles or members" value={targetSearch} onChange={e => setTargetSearch(e.target.value)} placeholder="Search roles or members" />
          <div className="my-2 flex gap-2" role="group" aria-label="Target type"><Button size="sm" variant={pickerTab === "role" ? "default" : "ghost"} onClick={() => setPickerTab("role")}>Roles</Button><Button size="sm" variant={pickerTab === "member" ? "default" : "ghost"} onClick={() => setPickerTab("member")}>Members</Button></div>
          <div className="permission-picker-list">{candidates.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matching {pickerTab === "role" ? "roles" : "members"}.</p>}{candidates.map(t => {
            const exists = targets.some(target => sameTarget(target, t));
            return <button type="button" className="core-context-menu-item" key={targetKey(t)} aria-pressed={exists} disabled={!t.manageable} title={!t.manageable ? "This target is protected by role hierarchy." : undefined} onClick={() => { if (!exists) setTargets(previous => [...previous, { kind: t.kind, id: t.id }]); setSelected({ kind: t.kind, id: t.id }); setPicker(false); }}>{avatar(t)}<span>{t.name}{t.username && <small className="block text-muted-foreground">@{t.username}</small>}</span>{exists && <Check aria-hidden="true" />}</button>;
          })}</div>
        </Popover.Content></Popover.Portal>
      </Popover.Root></div>
      <ul className="permission-targets">{targets.map(target => <li key={targetKey(target)}><button type="button" className="permission-target" aria-pressed={selected ? sameTarget(selected, target) : false} onClick={() => setSelected(target)}>{avatar(target)}<span>{label(target)}</span></button>{target.id !== everyone?.id && <button type="button" className="icon-button" aria-label={`Remove overrides for ${label(target)}`} disabled={!manageable(target) || mutation.isPending} onClick={() => { if (saving.current) return; setEntries(previous => previous.filter(e => !sameTarget(e, target))); const next = targets.filter(t => !sameTarget(t, target)); setTargets(next); if (selected && sameTarget(selected, target)) setSelected(next[0]); }}><Trash2 size={14} aria-hidden="true" /></button>}</li>)}</ul>
      <p className="permission-neutral-help">Neutral (/) keeps the permissions already granted by roles. It does not mean category synchronization.</p>
    </aside><section aria-label="Permission overrides">
      <div className="permission-search"><Search size={16} aria-hidden="true" /><Input aria-label="Search permissions" placeholder="Search permissions" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="permission-editing-heading"><span>{selected ? `Editing ${label(selected)}` : "Select a role or member"}</span><Button size="sm" variant="ghost" disabled={!manageable(selected) || !canClear || mutation.isPending} onClick={() => setConfirmation("clear")}>Clear Permissions</Button></div>
      {selected && !manageable(selected) && <p className="text-xs text-muted-foreground">This target is protected by role hierarchy. Its overrides are read-only.</p>}
      {filtered.length === 0 && <p role="status" className="py-6 text-sm text-muted-foreground">No permissions match your search.</p>}
      {filtered.map((permission, index) => {
        const state = entries.find(e => selected && sameTarget(e, selected) && e.permission === permission.key)?.state ?? null;
        const unavailable = permissionAvailability(permission);
        const descriptionId = `${id}-${permission.key}`;
        return <div key={permission.key}>
          {(index === 0 || filtered[index - 1]?.group !== permission.group) && <h4 className="permission-group">{permission.group}</h4>}
          <div className="permission-row"><div><strong>{permission.label}</strong><p id={descriptionId}>{permission.desc}</p>{unavailable && <p className="permission-unavailable">{unavailable}</p>}</div><div className="permission-states" role="group" aria-label={permission.label} aria-describedby={descriptionId}>
            {([false, null, true] as const).map((value, i) => {
              const name = ["Deny", "Neutral", "Allow"][i]!;
              const deniedGrant = value === true && !base.grantable.includes(permission.key);
              return <button key={name} type="button" data-state={name.toLowerCase()} aria-label={`${name} ${permission.label}`} title={deniedGrant ? "You cannot grant a permission you do not have." : value === null ? "Neutral: keep earlier permission grants" : `${name} for this target`} aria-pressed={state === value} disabled={!manageable(selected) || mutation.isPending || Boolean(unavailable) || deniedGrant} onClick={() => { if (selected) setState(selected, permission.key, value); }}>{i === 0 ? <X aria-hidden="true" /> : i === 1 ? <Slash aria-hidden="true" /> : <Check aria-hidden="true" />}</button>;
            })}
          </div></div>
        </div>;
      })}
    </section></div>
    {mutation.isError && <p role="alert" className="my-3 text-sm text-destructive">{apiErrorMessage(mutation.error)} Your draft is preserved. You can retry or load the latest permissions.</p>}
    <div className="permission-save"><span className="text-sm text-muted-foreground" role="status">{dirty ? "You have unsaved changes." : mutation.isSuccess ? "Permissions saved." : "Changes apply when saved."}</span><Button variant="ghost" disabled={!dirty || mutation.isPending} onClick={() => restore(base)}>Reset</Button><Button disabled={!dirty || mutation.isPending} onClick={() => save()}>{mutation.isPending ? "Saving..." : "Save Changes"}</Button></div>
    <Dialog.Root open={confirmation !== null} onOpenChange={open => { if (!open && !mutation.isPending) setConfirmation(null); }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="standard-dialog">
      <Dialog.Title>{confirmation === "sync" ? "Sync permissions with category?" : confirmation === "clear" ? "Clear target permissions?" : "Load latest permissions?"}</Dialog.Title>
      <Dialog.Description className="my-4">{confirmation === "sync" ? "This replaces independent overrides and unsaved changes with the category's permissions. Future category changes will apply to this channel." : confirmation === "clear" ? "Reset this target's applicable overrides to Neutral. Other targets keep their settings. Save Changes applies this draft." : "Discard this draft and load the latest permissions from the server."}</Dialog.Description>
      {mutation.isError && <p role="alert" className="mb-3 text-sm text-destructive">{apiErrorMessage(mutation.error)} Your draft is preserved.</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={() => setConfirmation(null)}>Cancel</Button><Button disabled={mutation.isPending} onClick={() => {
        if (confirmation === "sync") save(true);
        else if (confirmation === "reload") restore(remote);
        else { if (selected && !saving.current) setEntries(previous => previous.filter(e => !sameTarget(e, selected) || !applicable.some(p => p.key === e.permission))); setConfirmation(null); }
      }}>{confirmation === "sync" ? "Sync permissions" : confirmation === "clear" ? "Clear Permissions" : "Discard and load latest"}</Button></div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
