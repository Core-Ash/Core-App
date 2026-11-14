import { useRef } from "react";
import {
  CalendarDays,
  ChevronDown,
  Hash,
  House,
  LockKeyhole,
  Users,
  Volume2,
} from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import {
  previewCommunities,
  previewMembers,
} from "@/features/community/preview/preview-data";
import {
  previewHref,
  usePreviewSelection,
} from "@/features/community/preview/use-preview-selection";
import { MemberAvatar } from "@/features/community/components/MemberAvatar";
import { CommunityEmblem } from "@/features/community/components/CommunityEmblem";
import { useOptionalAppData } from "@/app/app-data-context";
import { LiveCommunitySidebar } from "@/features/community/components/LiveCommunitySidebar";

export function CommunitySidebar({ onNavigate }: { onNavigate?: () => void }) {
  const data = useOptionalAppData();
  return data?.configured ? (
    <LiveCommunitySidebar onNavigate={onNavigate} />
  ) : (
    <PreviewCommunitySidebar onNavigate={onNavigate} />
  );
}

function PreviewCommunitySidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { community, channel, view } = usePreviewSelection();
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
        <summary aria-label={`Choose community, ${community.name}`}>
          <span className="community-banner-art" aria-hidden="true" />
          <strong>{community.name}</strong>
          <ChevronDown size={20} aria-hidden="true" />
        </summary>
        <div className="community-picker-menu">
          <p>Sample communities</p>
          {previewCommunities.map((item) => (
            <Link
              key={item.id}
              to={previewHref(item.id)}
              aria-current={item.id === community.id ? "true" : undefined}
              onClick={() => {
                if (picker.current) picker.current.open = false;
                onNavigate?.();
              }}
            >
              <CommunityEmblem emblem={item.emblem} />
              <span>{item.name}</span>
            </Link>
          ))}
        </div>
      </details>
      <div className="sidebar-scroll">
        <nav aria-label="Community navigation" className="community-navigation">
          {(
            [
              { id: "channel", label: "Overview", icon: House },
              { id: "events", label: "Events", icon: CalendarDays },
              { id: "members", label: "Members", icon: Users },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              to={previewHref(community.id, channel.id, id)}
              onClick={onNavigate}
              className={cn(
                "sidebar-link",
                (view === id || (view === "overview" && id === "channel")) &&
                  "is-active",
              )}
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
          <nav aria-label="Text channels">
            {community.channels.map((item) => (
              <Link
                key={item.id}
                to={previewHref(community.id, item.id)}
                onClick={onNavigate}
                className={cn(
                  "sidebar-link channel-link",
                  view === "channel" && channel.id === item.id && "is-active",
                )}
                aria-current={
                  view === "channel" && channel.id === item.id
                    ? "page"
                    : undefined
                }
              >
                <Hash size={20} aria-hidden="true" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </details>
        <details open className="channel-section voice-channel-section">
          <summary>
            <ChevronDown size={16} aria-hidden="true" />
            Voice Channels
          </summary>
          {community.voiceChannels.map((voice) => {
            const Icon = voice.id === "afk" ? LockKeyhole : Volume2;
            const member = previewMembers.find(
              (item) => item.id === voice.sampleMemberIds[0],
            );
            return (
              <button
                key={voice.id}
                className="sidebar-link voice-channel"
                disabled
                aria-label={`${voice.name} — voice connection unavailable`}
                title="Voice is unavailable. Participant counts are sample activity."
              >
                <Icon size={20} aria-hidden="true" />
                <span>{voice.name}</span>
                {member && (
                  <span
                    className="voice-counter"
                    aria-label={`${voice.sampleMemberIds.length} sample participants`}
                  >
                    <MemberAvatar member={member} small />
                    <span>{voice.sampleMemberIds.length}</span>
                  </span>
                )}
              </button>
            );
          })}
          {!community.voiceChannels.some(
            (voice) => voice.sampleMemberIds.length > 0,
          ) && <p className="voice-empty">No active voice users.</p>}
        </details>
      </div>
    </>
  );
}
