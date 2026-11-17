import { CalendarDays, Hash, Plus, Volume2 } from "lucide-react";
import { Link } from "react-router";
import { ApiNotice } from "@/components/common/ApiNotice";
import { Tooltip } from "@/components/ui/tooltip";
import { CreateChannelDialog } from "@/features/community/components/CreateResourceDialog";
import { ChannelCategory } from "@/features/community/components/ChannelCategory";
import { ServerDropdown } from "@/features/community/components/ServerDropdown";
import { useCurrentUser } from "@/features/community/api/hooks";
import { useInvitePermissions } from "@/features/invites/api";
import { communityHref, useCommunitySelection } from "@/features/community/api/use-community-selection";
import { cn } from "@/lib/utils";

export function LiveCommunitySidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { community, communities, channels, channel, channelItems, view } = useCommunitySelection();
  const permissions = useInvitePermissions(community?.id ?? "");
  const profile = useCurrentUser();
  const owner = Boolean(community && profile.isSuccess && community.owner_id === profile.data.id);
  const canCreate = owner || (permissions.isSuccess && permissions.data.manage_channels);
  return (
    <>
      <ServerDropdown key={community?.id ?? "none"} community={community} canCreateChannel={canCreate} onNavigate={onNavigate} />
      <div className="sidebar-scroll">
        {community && <nav className="community-navigation" aria-label="Server events">
          <Link className={cn("sidebar-link", view === "events" && "is-active")} to={communityHref(community.id, undefined, "events")} aria-current={view === "events" ? "page" : undefined} onClick={onNavigate}><CalendarDays size={18} aria-hidden="true" /><span>Events</span></Link>
        </nav>}
        {communities.error && <ApiNotice compact error={communities.error} onRetry={() => { void communities.refetch(); }} />}
        {community && <ChannelCategory key={community.id} name="Text Channels" action={canCreate && (
          <Tooltip content="Create Channel">
            <CreateChannelDialog communityId={community.id}>
              <button className="icon-button channel-category-add" aria-label="Create Channel">
                <Plus size={16} aria-hidden="true" />
              </button>
            </CreateChannelDialog>
          </Tooltip>
        )}>
          {channels.isPending && <ApiNotice loading="Loading channelsâ€¦" />}
          {channels.error && <ApiNotice compact error={channels.error} onRetry={() => { void channels.refetch(); }} />}
          <nav aria-label="Text channels">
            {channelItems.map((item) => <Link key={item.id} to={communityHref(community.id, item.id)} onClick={onNavigate}
              className={cn("sidebar-link channel-link", view === "channel" && channel?.id === item.id && "is-active")}
              aria-current={view === "channel" && channel?.id === item.id ? "page" : undefined} title={item.name}>
              <Hash size={18} aria-hidden="true" /><span>{item.name}</span>
            </Link>)}
          </nav>
        </ChannelCategory>}
        <ChannelCategory name="Voice Channels">
          <button className="sidebar-link voice-channel" disabled><Volume2 size={18} aria-hidden="true" /><span>Voice unavailable</span></button>
        </ChannelCategory>
      </div>
    </>
  );
}
