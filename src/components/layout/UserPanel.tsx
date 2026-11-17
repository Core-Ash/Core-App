import { Headphones, Mic, Settings } from "lucide-react";
import { Link } from "react-router";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Tooltip } from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/auth-context";
import { useOptionalAppData } from "@/app/app-data-context";
import { useCurrentUser } from "@/features/community/api/hooks";
import { useOptionalSettingsModal } from "@/features/settings/settings-context";
import type { AuthUser } from "@/lib/auth-client";
import { displayName, publicIdentityLabel } from "@/lib/display-name";

export function UserPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useAuth();
  const data = useOptionalAppData();
  if (!session) return null;
  if (data?.configured) return <BackendUserPanel onNavigate={onNavigate} />;
  return (
    <UserPanelView
      user={{ ...session.user, name: publicIdentityLabel(session.user.name, session.user.id) || "Unknown User" }}
      onNavigate={onNavigate}
    />
  );
}

function BackendUserPanel({ onNavigate }: { onNavigate?: () => void }) {
  const profile = useCurrentUser();
  const user = profile.isSuccess ? profile.data : undefined;
  return (
    <UserPanelView
      user={{
        name: displayName(user),
        email: "",
        image: user?.avatar_url,
      }}
      onNavigate={onNavigate}
    />
  );
}

function UserPanelView({
  user,
  onNavigate,
}: {
  user: Pick<AuthUser, "name" | "email" | "image">;
  onNavigate?: () => void;
}) {
  const settingsModal = useOptionalSettingsModal();
  return (
    <section className="user-panel" aria-label="Signed-in account">
      <div className="user-panel-profile">
        <span className="member-avatar">
          <UserAvatar user={user} className="profile-avatar" />
        </span>
        <div className="user-panel-name">
          <p title={user.name}>{user.name || "Core member"}</p>
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
            {settingsModal ? (
              <button
                type="button"
                className="icon-button"
                aria-label="Account settings"
                aria-haspopup="dialog"
                aria-expanded={settingsModal.open}
                onClick={(event) => {
                  const trigger = event.currentTarget;
                  onNavigate?.();
                  settingsModal.openSettings("my-account", trigger);
                }}
              >
                <Settings size={22} aria-hidden="true" />
              </button>
            ) : (
              <Link
                className="icon-button"
                to="/app/settings"
                aria-label="Account settings"
                onClick={onNavigate}
              >
                <Settings size={22} aria-hidden="true" />
              </Link>
            )}
          </Tooltip>
        </div>
      </div>
    </section>
  );
}
