import { useEffect, useId, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { ApiNotice } from "@/components/common/ApiNotice";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMembers } from "@/features/community/api/hooks";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import type { ServerMember } from "@/lib/api/types";

export function MemberDirectory({ communityId, channelId }: { communityId: string; channelId?: string }) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [settledSearch, setSettledSearch] = useState("");
  const normalized = search.trim();
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(normalized), 300);
    return () => clearTimeout(timer);
  }, [normalized]);
  const settled = normalized === settledSearch;
  const query = useMembers(communityId, channelId, normalized, settled);
  const groups = useMemo(() => {
    const members = [...new Map(query.data?.pages.flatMap((page) => page.items).map((member) => [member.id, member])).values()];
    const groups = new Map<string, { id: string; name: string; color: string | null; position: number; members: ServerMember[] }>();
    for (const member of members) {
      // Roles arrive in backend rank order; grouping never decides visibility.
      const highest = member.roles[0];
      const key = highest?.id ?? "no-role";
      const group = groups.get(key) ?? { id: key, name: highest?.name ?? "Members", color: highest?.color ?? null, position: highest?.position ?? -1, members: [] };
      group.members.push(member);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));
  }, [query.data]);
  const total = query.data?.pages[0]?.total;
  return (
    <div className="member-sidebar-content" aria-label={channelId ? "Channel member directory" : "Community member directory"}>
      <div className="member-sidebar-scroll">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Members{total !== undefined && settled && !query.isError ? ` · ${total}` : ""}</h2>
          <Button size="sm" variant="ghost" disabled={query.isFetching || !settled} onClick={() => { void query.refetch(); }}>Refresh members</Button>
        </div>
        <label htmlFor={id} className="sr-only">Search members</label>
        <Input id={id} type="search" placeholder="Search members" maxLength={100} value={search} className="mb-4" onChange={(event) => setSearch(event.target.value)} />
        {query.isError ? <ApiNotice compact error={query.error} onRetry={() => { void query.refetch(); }} />
          : query.isPending || !settled ? <div role="status" aria-label="Loading members" className="space-y-3">
            <span className="sr-only">Loading members…</span>
            {[0,1,2,3].map((value) => <div key={value} className="h-12 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-hidden="true" />)}
          </div> : groups.length ? <>
            <p className="sr-only" role="status">{total} matching members</p>
            {groups.map((group) => <section className="member-group" key={group.id} aria-label={`${group.name} members`}>
              <h3 className="flex items-center gap-2"><span className="access-role-color" style={{ backgroundColor: group.color ?? "var(--muted-foreground)" }} aria-hidden="true" />{group.name} <span>· {group.members.length} loaded</span></h3>
              <ul>{group.members.map((member) => <li className="member-row" key={member.id}>
                <MemberIdentity profile={member} roles={member.roles} joinedAt={member.joined_at} />
              </li>)}</ul>
            </section>)}
            {query.hasNextPage && <Button variant="outline" disabled={query.isFetching} onClick={() => { void query.fetchNextPage(); }}>
              {query.isFetchingNextPage ? "Loading members…" : "Load more members"}
            </Button>}
          </> : <EmptyState icon={Users} title={normalized ? "No matching members" : "No members to show"}
            description={normalized ? "Try another name or username." : "No members are visible in this scope."} />}
      </div>
    </div>
  );
}
