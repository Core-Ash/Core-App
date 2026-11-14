import { Headphones, Mic, Settings } from "lucide-react";
import { Link } from "react-router";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Tooltip } from "@/components/ui/tooltip";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { useAuth } from "@/features/auth/auth-context";

export function UserPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <section className="user-panel" aria-label="Signed-in account">
      <div className="user-panel-profile">
        <span className="member-avatar">
          <UserAvatar user={session.user} className="profile-avatar" />
          <StatusIndicator status="online" label="Signed in to Core" />
        </span>
        <div className="user-panel-name">
          <p title={session.user.name}>{session.user.name || "Core member"}</p>
          <span title="Signed in; live presence is unavailable">Online</span>
        </div>
        <div className="user-controls">
          <Tooltip content="Microphone unavailable · voice is not connected">
            <button
              className="icon-button"
              disabled
              aria-label="Microphone unavailable — voice is not connected"
            >
              <Mic size={21} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Deafen unavailable · voice is not connected">
            <button
              className="icon-button"
              disabled
              aria-label="Deafen unavailable — voice is not connected"
            >
              <Headphones size={22} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Account settings and sign out">
            <Link
              className="icon-button"
              to="/app/settings"
              aria-label="Account settings"
              onClick={onNavigate}
            >
              <Settings size={22} aria-hidden="true" />
            </Link>
          </Tooltip>
        </div>
      </div>
    </section>
  );
}
