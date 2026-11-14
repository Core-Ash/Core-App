import { useRef } from "react";
import {
  CalendarDays,
  ChevronDown,
  Hash,
  House,
  Plus,
  Users,
  Volume2,
} from "lucide-react";
import { Link } from "react-router";
import { ApiNotice } from "@/components/common/ApiNotice";
import { CreateChannelDialog } from "@/features/community/components/CreateResourceDialog";
import {
  communityHref,
  useCommunitySelection,
} from "@/features/community/api/use-community-selection";
import { cn } from "@/lib/utils";

export function LiveCommunitySidebar({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const {
    community,
    communities,
    communityItems,
    channels,
    channel,
    channelItems,
    view,
  } = useCommunitySelection();
  const picker = useRef<HTMLDetailsElement>(null);
  return (
    <>
      <details
        className="community-picker"
        ref={picker}
        onKeyDown={(event) => {
          if (event.key === "Escape" && picker.current) {
            picker.current.open = false;
            picker.current.querySelector("summary")?.focus();
          }
        }}
      >
        <summary aria-label={`Choose community, ${community?.name ?? "Core"}`}>
          <span className="community-banner-art" aria-hidden="true" />
          <strong>{community?.name ?? "Core"}</strong>
          <ChevronDown size={20} aria-hidden="true" />
        </summary>
        <div className="community-picker-menu">
          <p>Your communities</p>
          {communityItems.map((item) => (
            <Link
              key={item.id}
              to={communityHref(item.id)}
              aria-current={item.id === community?.id ? "true" : undefined}
              onClick={() => {
                if (picker.current) picker.current.open = false;
                onNavigate?.();
              }}
            >
              <Hash size={20} aria-hidden="true" />
              <span>{item.name}</span>
            </Link>
          ))}
        </div>
      </details>
      <div className="sidebar-scroll">
        {communities.error && (
          <ApiNotice
            compact
            error={communities.error}
            onRetry={() => {
              void communities.refetch();
            }}
          />
        )}
        {community && (
          <>
            <nav
              aria-label="Community navigation"
              className="community-navigation"
            >
              {(
                [
                  { id: "channel", label: "Overview", icon: House },
                  { id: "events", label: "Events", icon: CalendarDays },
                  { id: "members", label: "Members", icon: Users },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <Link
                  key={id}
                  to={communityHref(community.id, channel?.id, id)}
                  onClick={onNavigate}
                  className={cn("sidebar-link", view === id && "is-active")}
                  aria-current={view === id ? "page" : undefined}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <details open className="channel-section text-channel-section">
              <summary>
                <ChevronDown size={16} aria-hidden="true" />
                Text Channels
              </summary>
              {channels.isPending && <ApiNotice loading="Loading channels…" />}
              {channels.error && (
                <ApiNotice
                  compact
                  error={channels.error}
                  onRetry={() => {
                    void channels.refetch();
                  }}
                />
              )}
              <nav aria-label="Text channels">
                {channelItems.map((item) => (
                  <Link
                    key={item.id}
                    to={communityHref(community.id, item.id)}
                    onClick={onNavigate}
                    className={cn(
                      "sidebar-link channel-link",
                      view === "channel" &&
                        channel?.id === item.id &&
                        "is-active",
                    )}
                    aria-current={
                      view === "channel" && channel?.id === item.id
                        ? "page"
                        : undefined
                    }
                  >
                    <Hash size={20} aria-hidden="true" />
                    <span>{item.name}</span>
                  </Link>
                ))}
              </nav>
              <CreateChannelDialog
                key={community.id}
                communityId={community.id}
              >
                <button className="sidebar-link">
                  <Plus size={18} aria-hidden="true" />
                  <span>Create channel</span>
                </button>
              </CreateChannelDialog>
            </details>
          </>
        )}
        <details open className="channel-section voice-channel-section">
          <summary>
            <ChevronDown size={16} aria-hidden="true" />
            Voice Channels
          </summary>
          <button className="sidebar-link voice-channel" disabled>
            <Volume2 size={20} aria-hidden="true" />
            Voice unavailable
          </button>
        </details>
      </div>
    </>
  );
}
