import { useEffect, useRef } from "react";
import { ChevronDown, Hash, Plus, Settings, Volume2 } from "lucide-react";
import { Link } from "react-router";
import { ApiNotice } from "@/components/common/ApiNotice";
import { Tooltip } from "@/components/ui/tooltip";
import { CreateChannelDialog } from "@/features/community/components/CreateResourceDialog";
import { ChannelCategory } from "@/features/community/components/ChannelCategory";
import { useCurrentUser } from "@/features/community/api/hooks";
import { communityHref, useCommunitySelection } from "@/features/community/api/use-community-selection";
import { cn } from "@/lib/utils";

export function LiveCommunitySidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { community, communities, communityItems, channels, channel, channelItems, view } = useCommunitySelection();
  const profile = useCurrentUser();
  // Channel access does not establish server-wide creation permission.
  const canCreate = Boolean(community && profile.isSuccess && community.owner_id === profile.data.id);
  const picker = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !picker.current?.contains(event.target) && picker.current) picker.current.open = false;
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const navigate = () => {
    if (picker.current) picker.current.open = false;
    onNavigate?.();
  };
  return (
    <>
      <details className="community-picker" ref={picker} onKeyDown={(event) => {
        if (event.key === "Escape" && picker.current) {
          picker.current.open = false;
          picker.current.querySelector("summary")?.focus();
        }
      }}>
        <summary aria-label={`Server menu, ${community?.name ?? "Core"}`}>
          <span className="community-banner-art" aria-hidden="true" />
          <strong>{community?.name ?? "Core"}</strong>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className="community-picker-menu">
          {community && <>
            <Link to={communityHref(community.id, channel?.id, "overview")} onClick={navigate}>
              <Settings size={18} aria-hidden="true" /><span>Server Settings</span>
            </Link>
            {canCreate && <CreateChannelDialog key={community.id} communityId={community.id}>
              <button className="server-menu-action"><Plus size={18} aria-hidden="true" /><span>Create Channel</span></button>
            </CreateChannelDialog>}
            <hr />
          </>}
          <p>Your communities</p>
          {communityItems.map((item) => <Link key={item.id} to={communityHref(item.id)}
            aria-current={item.id === community?.id ? "true" : undefined} onClick={navigate}>
            <Hash size={18} aria-hidden="true" /><span>{item.name}</span>
          </Link>)}
        </div>
      </details>
      <div className="sidebar-scroll">
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
          {channels.isPending && <ApiNotice loading="Loading channels…" />}
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
