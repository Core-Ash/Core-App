import { CalendarDays, Hash } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/common/EmptyState";
import { communityHref } from "@/features/community/api/use-community-selection";
import { CommunityMembers } from "@/features/community/components/CommunityMembers";
import type { CommunityView } from "@/features/community/types";
import type { Community, Profile } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function ServerSettings({ community, profile, channelId, view }: {
  community: Community; profile: Profile; channelId?: string; view: CommunityView;
}) {
  return (
    <section className="server-settings" aria-label={`${community.name} server settings`}>
      <div className="server-settings-title"><h1>Server Settings</h1>
        <Link className="server-settings-back" to={communityHref(community.id, channelId)}>Back to channels</Link>
      </div>
      <nav className="server-settings-tabs" aria-label="Server settings sections">
        {([{ view: "overview", name: "Overview" }, { view: "members", name: "Members" }, { view: "events", name: "Events" }] as const).map((item) =>
          <Link key={item.view} to={communityHref(community.id, channelId, item.view)}
            className={cn("sidebar-link", view === item.view && "is-active")} aria-current={view === item.view ? "page" : undefined}>{item.name}</Link>)}
      </nav>
      {view === "members" ? <CommunityMembers community={community} profile={profile} />
        : view === "events" ? <EmptyState icon={CalendarDays} title="Events unavailable" description="Events aren't available yet." />
        : <div className="server-overview">
          <div className="server-overview-banner"><span className="community-banner-art" aria-hidden="true" /><h2>{community.name}</h2></div>
          <div className="server-overview-info"><Hash size={28} aria-hidden="true" /><div><h3>Server name</h3><p>{community.name}</p></div></div>
          <p className="text-sm text-muted-foreground">Server name, icon, and banner editing are unavailable.</p>
        </div>}
    </section>
  );
}
