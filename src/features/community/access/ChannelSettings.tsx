import { PermissionsEditor } from "./PermissionsEditor";
import { ChannelInviteSettings } from "./ChannelInviteSettings";
import { DeleteChannelSettings } from "./DeleteChannelSettings";
import { useEffect, useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Eye, Folder, Link2, LockKeyhole, RefreshCw, Settings, Shield, Trash2, X } from "lucide-react";
import { ApiNotice } from "@/components/common/ApiNotice";
import { EmptyState } from "@/components/common/EmptyState";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useChannelAccess } from "@/features/community/api/hooks";
import { useCategories, useUpdateChannel } from "@/features/community/categories/api";
import type { AccessSource, Channel, Community } from "@/lib/api/types";

function sourceLabel(source: AccessSource): string {
  switch (source.kind) {
    case "owner": return "Community owner";
    case "administrator": return "Administrator bypass";
    case "member_allow": return "Explicit member allow";
    case "member_deny": return "Explicit member denial";
    case "role_allow": return `Channel allow through ${source.role_name}`;
    case "role_deny": return `Channel denial through ${source.role_name}`;
    case "inherited": return `Inherited from ${source.role_name}`;
    case "no_grant": return "No view permission granted";
  }
}

export function ChannelSettings({ community, channel, open: controlledOpen, onOpenChange }: { community: Community; channel: Channel; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [localOpen, setLocalOpen] = useState(false);
  const [permissionDirty, setPermissionDirty] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (value: boolean) => { setLocalOpen(value); onOpenChange?.(value); };
  const [view, setView] = useState<"overview" | "permissions" | "access" | "invites" | "delete">("permissions");
  const changeView = (next: typeof view) => { if (next === view || !permissionDirty || window.confirm("Discard unsaved permission changes?")) setView(next); };

  return (
    <Dialog.Root open={open} onOpenChange={(value) => {
      if (!value && permissionDirty && !window.confirm("Discard unsaved permission changes?")) return;
      setOpen(value);
      if (!value) setView("permissions");
    }}>
      {controlledOpen === undefined && <Tooltip content="Channel settings">
        <Dialog.Trigger asChild>
          <button className="icon-button" aria-label="Channel settings">
            <Settings size={23} aria-hidden="true" />
          </button>
        </Dialog.Trigger>
      </Tooltip>}
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="standard-dialog channel-settings-dialog">
          <header className="channel-settings-heading">
            <Dialog.Title className="text-xl font-semibold">#{channel.name} settings</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              {community.name} · Channel settings
            </Dialog.Description>
          </header>
          <div className="channel-settings-body">
            <nav aria-label="Channel settings sections" className="channel-settings-navigation">
              <Button
                variant={view === "overview" ? "default" : "ghost"}
                onClick={() => changeView("overview")}
                aria-current={view === "overview" ? "page" : undefined}
              >
                <Folder aria-hidden="true" /> Overview
              </Button>
              <Button
                variant={view === "permissions" || view === "access" ? "default" : "ghost"}
                onClick={() => changeView("permissions")}
                aria-current={view === "permissions" || view === "access" ? "page" : undefined}
              >
                <Shield aria-hidden="true" /> Permissions
              </Button>
              <Button variant={view === "invites" ? "default" : "ghost"} onClick={() => changeView("invites")} aria-current={view === "invites" ? "page" : undefined}><Link2 aria-hidden="true" />Invites</Button>
              <div className="my-3 border-t border-border" />
              <Button variant="ghost" className="text-destructive" onClick={() => changeView("delete")} aria-current={view === "delete" ? "page" : undefined}><Trash2 aria-hidden="true" />Delete Channel</Button>
            </nav>
            <section className="channel-permissions-panel" aria-label={view === "overview" ? "Overview" : view === "invites" ? "Invites" : view === "delete" ? "Delete Channel" : "Permissions"}>
              {view === "invites" ? <ChannelInviteSettings community={community} channel={channel} /> : view === "delete" ? <DeleteChannelSettings community={community} channel={channel} onDeleted={() => setOpen(false)} /> : view === "overview" ? (
                <ChannelOverviewForm key={channel.id} community={community} channel={channel} />
              ) : view === "permissions" ? (
                <>
                  <PermissionsEditor communityId={community.id} resourceId={channel.id} onDirtyChange={setPermissionDirty} />
                  <p className="my-3 text-sm text-muted-foreground">
                    See who can view this channel and how access is granted.
                    Community owners and members with channel management permission can inspect access.
                  </p>
                  <Button variant="outline" onClick={() => changeView("access")}>
                    <Eye aria-hidden="true" /> View Channel Access
                  </Button>

                </>
              ) : (
                <>
                  <Button variant="ghost" className="mb-3" onClick={() => setView("permissions")}>
                    <ArrowLeft aria-hidden="true" /> Back to permissions
                  </Button>
                  <ChannelAccess communityId={community.id} channelId={channel.id} />
                </>
              )}
            </section>
          </div>
          <Dialog.Close asChild>
            <button className="icon-button dialog-close" aria-label="Close channel settings"><X size={20} aria-hidden="true" /></button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ChannelOverviewForm({ community, channel }: { community: Community; channel: Channel }) {
  const categoriesQuery = useCategories(community.id);
  const updateChannel = useUpdateChannel(community.id);
  const [selectedCategory, setSelectedCategory] = useState<string>(channel.category_id ?? "");
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? "");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateChannel.mutateAsync({
        channelId: channel.id,
        name: name.trim(),
        topic: topic.trim() || undefined,
        category_id: selectedCategory || null,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <form onSubmit={handleSaveOverview} className="space-y-4">
      <h2 className="text-lg font-semibold">Overview</h2>
      <div>
        <label htmlFor="channel-name-input" className="mb-1 block text-sm font-medium">Channel Name</label>
        <Input
          id="channel-name-input"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="channel-topic-input" className="mb-1 block text-sm font-medium">Channel Topic</label>
        <Input
          id="channel-topic-input"
          value={topic}
          maxLength={1024}
          placeholder="Let everyone know how to use this channel"
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="channel-category-select" className="mb-1 block text-sm font-medium">Category</label>
        <select
          id="channel-category-select"
          className="access-role-select w-full"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">(No Category / Uncategorized)</option>
          {categoriesQuery.data?.items.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Organize where this channel lives in the sidebar.
        </p>
      </div>
      {updateChannel.isError && (
        <p className="text-sm text-destructive">Failed to save channel changes.</p>
      )}
      {saveSuccess && (
        <p className="text-sm text-green-500">Channel updated successfully!</p>
      )}
      <Button type="submit" disabled={updateChannel.isPending}>
        {updateChannel.isPending ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}

function AccessSkeleton() {
  return (
    <div role="status" aria-label="Loading channel access" className="space-y-3 py-5">
      <span className="sr-only">Loading channel access…</span>
      {[0, 1, 2].map((index) => <div key={index} className="h-14 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-hidden="true" />)}
    </div>
  );
}

export function ChannelAccess({ communityId, channelId }: { communityId: string; channelId: string }) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [settledSearch, setSettledSearch] = useState("");
  const [roleId, setRoleId] = useState("");
  const [access, setAccess] = useState<"allowed" | "denied">("allowed");
  const normalizedSearch = search.trim();
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(normalizedSearch), 300);
    return () => clearTimeout(timer);
  }, [normalizedSearch]);
  const settled = normalizedSearch === settledSearch;
  const query = useChannelAccess(communityId, channelId, { search: normalizedSearch, roleId, access }, settled);
  const overview = query.data?.pages[0];
  const members = [...new Map(query.data?.pages.flatMap((page) => page.items).map((member) => [member.id, member])).values()];
  // Hide cached sensitive results after any failed revalidation, including 403.
  if (query.isError) return <ApiNotice error={query.error} onRetry={() => { void query.refetch(); }} />;
  return (
    <div aria-label="Channel access" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Channel Access</h2>
          {overview && <p className="mt-1 text-sm text-muted-foreground">
            {overview.total_allowed} {overview.total_allowed === 1 ? "member can" : "members can"} view this channel
          </p>}
        </div>
        <Button variant="outline" disabled={query.isFetching || !settled} onClick={() => { void query.refetch(); }}>
          <RefreshCw className={query.isFetching ? "animate-spin" : ""} aria-hidden="true" /> Refresh access
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Owners always have access. Member overrides take precedence over role overrides; role allows override other role denials.
        Inherited access comes from a community role.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-search`} className="mb-1 block text-sm">Search members</label>
          <Input id={`${id}-search`} type="search" maxLength={100} value={search} placeholder="Name or username"
            onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-role`} className="mb-1 block text-sm">Filter by role</label>
          <select id={`${id}-role`} className="access-role-select" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
            <option value="">All roles</option>
            {overview?.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            {roleId && !overview?.roles.some((role) => role.id === roleId) && <option value={roleId}>Selected role</option>}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Member access filter">
        <Button variant={access === "allowed" ? "default" : "outline"} aria-pressed={access === "allowed"} onClick={() => setAccess("allowed")}>
          <Eye aria-hidden="true" /> With access{overview ? ` (${overview.total_allowed})` : ""}
        </Button>
        <Button variant={access === "denied" ? "default" : "outline"} aria-pressed={access === "denied"} onClick={() => setAccess("denied")}>
          <LockKeyhole aria-hidden="true" /> Without access{overview ? ` (${overview.total_denied})` : ""}
        </Button>
      </div>
      {query.isPending || !settled ? <AccessSkeleton /> : overview && (
        <>
          <section aria-label="Roles and channel overrides">
            <h3 className="font-semibold">Roles and channel overrides</h3>
            <p className="my-2 text-xs text-muted-foreground">Role counts can overlap. Individual denials can change a member's effective access.</p>
            {overview.roles.length ? <ul className="space-y-2">
              {overview.roles.map((role) => <li key={role.id} className="access-role-row">
                <span className="access-role-color" style={{ backgroundColor: role.color ?? "var(--muted-foreground)" }} aria-hidden="true" />
                <span className="min-w-0 flex-1 break-words">{role.name}</span>
                <span className="text-xs text-muted-foreground">{role.member_count} {role.member_count === 1 ? "member" : "members"}</span>
                <span className="access-badge" data-access={role.access}>{role.access === "none" ? "No grant" : role.access}</span>
              </li>)}
            </ul> : <p className="text-sm text-muted-foreground">No roles configured.</p>}
          </section>
          <section aria-label={access === "allowed" ? "Members with access" : "Members without access"}>
            <h3 className="font-semibold">{access === "allowed" ? "Members with access" : "Members without access"}</h3>
            <p role="status" className="my-2 text-xs text-muted-foreground">Showing {members.length} of {overview.filtered_total} matching members</p>
            {members.length ? <ul className="space-y-2">
              {members.map((member) => <li key={member.id} className="access-member-row">
                <div className="min-w-0 flex-1">
                  <MemberIdentity profile={member} />
                  {member.highest_role && <p className="mt-1 flex items-center gap-1 text-xs">
                    <span className="access-role-color" style={{ backgroundColor: member.highest_role.color ?? "var(--muted-foreground)" }} aria-hidden="true" />
                    {member.highest_role.name}
                  </p>}
                  <ul className="mt-1 text-xs text-muted-foreground" aria-label="Access sources">
                    {member.sources.map((source, index) => <li key={index}>{sourceLabel(source)}</li>)}
                  </ul>
                </div>
                <span className="access-badge" data-access={member.allowed ? "allowed" : "denied"}>{member.allowed ? "Allowed" : "Denied"}</span>
              </li>)}
            </ul> : <EmptyState icon={Eye} title="No matching members" description="Try a different name, role, or access filter." />}
            {query.hasNextPage && <Button variant="outline" className="mt-3" disabled={query.isFetching} onClick={() => { void query.fetchNextPage(); }}>
              {query.isFetchingNextPage ? "Loading members…" : "Load more members"}
            </Button>}
          </section>
          <p className="text-xs text-muted-foreground">Access refreshes every 30 seconds while open. Owner and Administrator access bypass ordinary channel overrides.</p>
        </>
      )}
    </div>
  );
}
