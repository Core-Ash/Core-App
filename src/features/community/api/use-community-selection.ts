import { useSearchParams } from "react-router";
import {
  useChannels,
  useCommunities,
  useCurrentUser,
} from "@/features/community/api/hooks";
import type { CommunityView } from "@/features/community/types";

export function communityHref(
  communityId: string,
  channelId?: string,
  view: CommunityView = "channel",
) {
  const params = new URLSearchParams({ community: communityId });
  if (channelId) params.set("channel", channelId);
  if (view !== "channel") params.set("view", view);
  return `/app?${params}`;
}

export function useCommunitySelection() {
  const [params] = useSearchParams();
  const communities = useCommunities();
  const profile = useCurrentUser();
  const communityItems =
    profile.isSuccess && communities.isSuccess ? communities.data : [];
  const community =
    communityItems.find((item) => item.id === params.get("community")) ??
    communityItems[0];
  const channels = useChannels(community?.id);
  const channelItems =
    profile.isSuccess && channels.isSuccess ? channels.data : [];
  const channel =
    channelItems.find((item) => item.id === params.get("channel")) ??
    channelItems[0];
  const requestedView = params.get("view");
  const view: CommunityView =
    requestedView === "events" || requestedView === "members"
      ? requestedView
      : "channel";
  return {
    communities,
    community,
    communityItems,
    channels,
    channel,
    channelItems,
    view,
  };
}
