import { Headphones, Settings, ShieldCheck } from "lucide-react";
import { UserAvatar } from "@/components/common/UserAvatar";
import { useAuth } from "@/features/auth/auth-context";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { useOptionalAppData } from "@/app/app-data-context";
import { useCurrentUser } from "@/features/community/api/hooks";
import { ApplicationProfileState } from "@/features/community/components/ApplicationProfile";
import { ApiNotice } from "@/components/common/ApiNotice";
import { ApiError } from "@/lib/api/errors";
import { displayName, publicIdentityLabel, publicUsername } from "@/lib/display-name";
import { UsernameSettings } from "@/features/friends/UsernameSettings";
import { CopyUsername } from "@/features/friends/CopyUsername";

export function SettingsPage() {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <div className="page-scroll">
      <header className="page-header">
        <Settings size={18} aria-hidden="true" />
        <span>Settings</span>
      </header>
      <div className="settings-content">
        <div className="page-intro">
          <p className="eyebrow">Make yourself at home</p>
          <h1>Your account</h1>
          <p>Your application profile.</p>
        </div>
        <BackendAccountProfile />
        <section className="settings-panel voice-settings">
          <Headphones size={21} aria-hidden="true" />
          <div>
            <h2>Voice & audio</h2>
            <p>
              Voice connections aren’t available yet. Microphone and deafen
              controls will be available when voice is supported.
            </p>
          </div>
        </section>
        <div className="settings-signout">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

function BackendAccountProfile() {
  const profile = useCurrentUser();
  const data = useOptionalAppData();
  if (data?.configurationError)
    return <ApiNotice error={new ApiError("configuration")} />;
  if (!profile.isSuccess) return <ApplicationProfileState />;
  const user = profile.data;
  return (
    <section className="settings-panel" aria-label="Account profile">
      <div className="settings-profile">
        <UserAvatar
          user={{
            name: displayName(user),
            email: user.email,
            image: user.avatar_url,
          }}
          className="size-14"
        />
        <div>
          <h2>{displayName(user)}</h2>
          <p>{user.email || "No email available"}</p>
        </div>
        <ShieldCheck
          className="text-online ml-auto shrink-0"
          size={22}
          aria-label="Application profile verified by Core"
        />
      </div>
      <dl>
        <div>
          <dt>Display name</dt>
          <dd>{publicIdentityLabel(user.display_name, user.id) || "Not set"}</dd>
        </div>
        <div>
          <dt>Username</dt>
          <dd>{publicUsername(user) || "Not set"}</dd>
        </div>
        <div>
          <dt>User tag</dt>
          <dd>{user.discriminator ? `#${user.discriminator}` : "Unavailable"}</dd>
        </div>
        <div>
          <dt>Email address</dt>
          <dd>{user.email || "Not available"}</dd>
        </div>
      </dl>
      <CopyUsername profile={user} />
      <UsernameSettings profile={user} />
    </section>
  );
}
