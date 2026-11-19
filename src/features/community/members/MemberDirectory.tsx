import { Users } from "lucide-react";
import { ApiNotice } from "@/components/common/ApiNotice";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { useMembers } from "@/features/community/api/hooks";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import { MemberSidebarSkeleton } from "@/components/common/skeleton/Skeletons";

export function MemberDirectory({ communityId, channelId }: { communityId: string; channelId?: string }) {
  const query = useMembers(communityId, channelId, "");
  const members = [...new Map(query.data?.pages.flatMap((page) => page.items).map((member) => [member.id, member])).values()];
  const total = query.data?.pages[0]?.total;
  return (
    <div className="member-sidebar-content" aria-label={channelId ? "Channel member directory" : "Community member directory"}>
      <div className="member-sidebar-scroll">
        <h2 className="member-list-heading">Members{total !== undefined && !query.isError ? ` — ${total}` : ""}</h2>
        {query.isError ? <ApiNotice compact error={query.error} onRetry={() => { void query.refetch(); }} />
          : query.isPending ? <MemberSidebarSkeleton count={6} /> : members.length ? <>
            <ul className="member-list" aria-label="Members">{members.map((member) => <li className="member-row" key={member.id}>
              <MemberIdentity profile={member} communityId={communityId} roles={member.roles} joinedAt={member.joined_at} username={false} />
            </li>)}</ul>
            {query.hasNextPage && <Button size="sm" variant="ghost" disabled={query.isFetching} onClick={() => { void query.fetchNextPage(); }}>
              {query.isFetchingNextPage ? "Loading members…" : "Load more members"}
            </Button>}
          </> : <EmptyState icon={Users} title="No members to show" description="There are no visible members here yet." />}
      </div>
    </div>
  );
}
