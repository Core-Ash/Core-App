import { Headphones, Settings, ShieldCheck } from "lucide-react";
import { UserAvatar } from "@/components/common/UserAvatar";
import { useAuth } from "@/features/auth/auth-context";
import { LogoutButton } from "@/features/auth/LogoutButton";

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
          <p>Your profile from your current sign-in session.</p>
        </div>
        <section className="settings-panel" aria-label="Account profile">
          <div className="settings-profile">
            <UserAvatar user={session.user} className="size-14" />
            <div>
              <h2>{session.user.name || "Core member"}</h2>
              <p>{session.user.email}</p>
            </div>
            <ShieldCheck
              className="text-online ml-auto shrink-0"
              size={22}
              aria-label="Session-backed profile"
            />
          </div>
          <dl>
            <div>
              <dt>Display name</dt>
              <dd>{session.user.name || "Core member"}</dd>
            </div>
            <div>
              <dt>Email address</dt>
              <dd>{session.user.email}</dd>
            </div>
            <div>
              <dt>Appearance</dt>
              <dd>Core dark · Red accent</dd>
            </div>
          </dl>
          <p className="settings-note">
            Profile editing and password recovery aren’t available here yet.
          </p>
        </section>
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
