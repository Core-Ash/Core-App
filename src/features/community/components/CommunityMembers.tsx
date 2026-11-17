import { MemberDirectory } from "@/features/community/members/MemberDirectory";
import type { Community, Profile } from "@/lib/api/types";

export function CommunityMembers({ community }: { community: Community; profile: Profile }) {
  return <section aria-label={`${community.name} membership`}>
    <h2 className="px-6 pt-6 text-xl font-semibold">Community members</h2>
    <MemberDirectory key={`members-${community.id}`} communityId={community.id} />
  </section>;
}
