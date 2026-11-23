import { useMemo } from "react";
import { Users } from "lucide-react";
import { ApiNotice } from "@/components/common/ApiNotice";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { useMembers } from "@/features/community/api/hooks";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import { MemberSidebarSkeleton } from "@/components/common/skeleton/Skeletons";
import type { ServerMember } from "@/lib/api/types";

interface MemberGroup {
  id: string;
  name: string;
  count: number;
  members: ServerMember[];
}

export function MemberDirectory({ communityId, channelId }: { communityId: string; channelId?: string }) {
  const query = useMembers(communityId, channelId, "");
  const members = useMemo(
    () => [...new Map(query.data?.pages.flatMap((page) => page.items).map((member) => [member.id, member])).values()],
    [query.data?.pages]
  );
  const total = query.data?.pages[0]?.total;

  const groups = useMemo(() => {
    const roleGroupsMap = new Map<string, { id: string; name: string; position: number; members: ServerMember[] }>();
    const onlineMembers: ServerMember[] = [];

    for (const member of members) {
      // Find roles with hoist: true, sorted by highest position first
      const hoistedRoles = (member.roles || [])
        .filter((r) => r.hoist && r.name !== "@everyone")
        .sort((a, b) => b.position - a.position);

      const topHoistedRole = hoistedRoles[0];
      if (topHoistedRole) {
        if (!roleGroupsMap.has(topHoistedRole.id)) {
          roleGroupsMap.set(topHoistedRole.id, {
            id: topHoistedRole.id,
            name: topHoistedRole.name,
            position: topHoistedRole.position,
            members: [],
          });
        }
        roleGroupsMap.get(topHoistedRole.id)!.members.push(member);
      } else {
        onlineMembers.push(member);
      }
    }

    // Sort role groups descending by position
    const sortedRoleGroups: MemberGroup[] = Array.from(roleGroupsMap.values())
      .sort((a, b) => b.position - a.position)
      .map((g) => ({
        id: g.id,
        name: g.name,
        count: g.members.length,
        members: g.members,
      }));

    const result: MemberGroup[] = [...sortedRoleGroups];
    if (onlineMembers.length > 0 || sortedRoleGroups.length === 0) {
      result.push({
        id: "online",
        name: sortedRoleGroups.length > 0 ? "Online" : "Members",
        count: sortedRoleGroups.length > 0 ? onlineMembers.length : (total ?? onlineMembers.length),
        members: onlineMembers,
      });
    }

    return result;
  }, [members, total]);

  return (
    <div className="member-sidebar-content" aria-label={channelId ? "Channel member directory" : "Community member directory"}>
      <div className="member-sidebar-scroll">
        {query.isError ? (
          <ApiNotice compact error={query.error} onRetry={() => { void query.refetch(); }} />
        ) : query.isPending ? (
          <MemberSidebarSkeleton count={6} />
        ) : members.length ? (
          <>
            {groups.map((group) => {
              if (group.members.length === 0) return null;
              return (
                <div key={group.id} className="member-group-section mb-4">
                  <h2 className="member-list-heading">
                    {group.name} — {group.count}
                  </h2>
                  <ul className="member-list" aria-label={group.name}>
                    {group.members.map((member) => {
                      const coloredRole = [...(member.roles || [])].sort((a, b) => b.position - a.position).find((r) => r.color);
                      return (
                        <li className="member-row" key={member.id}>
                          <MemberIdentity
                            profile={member}
                            communityId={communityId}
                            roles={member.roles}
                            joinedAt={member.joined_at}
                            username={false}
                            nameColor={coloredRole?.color}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {query.hasNextPage && (
              <Button size="sm" variant="ghost" disabled={query.isFetching} onClick={() => { void query.fetchNextPage(); }}>
                {query.isFetchingNextPage ? "Loading members…" : "Load more members"}
              </Button>
            )}
          </>
        ) : (
          <>
            <h2 className="member-list-heading">Members{total !== undefined ? ` — ${total}` : ""}</h2>
            <EmptyState icon={Users} title="No members to show" description="There are no visible members here yet." />
          </>
        )}
      </div>
    </div>
  );
}
