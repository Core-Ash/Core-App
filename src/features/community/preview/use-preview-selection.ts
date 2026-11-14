import { useSearchParams } from "react-router";
import { previewCommunities } from "@/features/community/preview/preview-data";
import type { CommunityView } from "@/features/community/preview/types";

export function previewHref(
  communityId: string,
  channelId = "general",
  view: CommunityView = "channel",
) {
  const params = new URLSearchParams({
    community: communityId,
    channel: channelId,
  });
  if (view !== "channel") params.set("view", view);
  return `/app?${params.toString()}`;
}

export function usePreviewSelection() {
  const [params] = useSearchParams();
  const community =
    previewCommunities.find((item) => item.id === params.get("community")) ??
    previewCommunities[0]!;
  const channel =
    community.channels.find((item) => item.id === params.get("channel")) ??
    community.channels[0]!;
  const requestedView = params.get("view");
  const view: CommunityView =
    requestedView === "overview" ||
    requestedView === "events" ||
    requestedView === "members"
      ? requestedView
      : "channel";
  return {
    community,
    channel,
    view,
    channelKey: `${community.id}/${channel.id}`,
  };
}
