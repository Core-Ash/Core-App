import { useNavigate } from "react-router";
import { communityHref } from "@/features/community/api/use-community-selection";
import { ServerSettingsLayout } from "@/features/community/server-settings/ServerSettingsLayout";
import type { ServerSettingsSection } from "@/features/community/server-settings/types";
import type { CommunityView } from "@/features/community/types";
import type { Community, Profile } from "@/lib/api/types";

export function ServerSettings({
  community,
  profile,
  channelId,
  view,
}: {
  community: Community;
  profile: Profile;
  channelId?: string;
  view: CommunityView;
}) {
  const navigate = useNavigate();

  const initialSection: ServerSettingsSection =
    view === "members"
      ? "members"
      : view === "invites"
      ? "invites"
      : "profile";

  return (
    <ServerSettingsLayout
      community={community}
      profile={profile}
      initialSection={initialSection}
      onClose={() => navigate(communityHref(community.id, channelId))}
    />
  );
}
