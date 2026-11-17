import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Accessibility,
  Bell,
  Headphones,
  Palette,
  Search,
  Shield,
  ShieldCheck,
  User,
  UserCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { UserAvatar } from "@/components/common/UserAvatar";
import { ApiNotice } from "@/components/common/ApiNotice";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { useOptionalAppData } from "@/app/app-data-context";
import { useCurrentUser } from "@/features/community/api/hooks";
import { ApplicationProfileState } from "@/features/community/components/ApplicationProfile";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import { CopyUsername } from "@/features/friends/CopyUsername";
import { UsernameSettings } from "@/features/friends/UsernameSettings";
import { useFriendAction, useFriendCounts, useFriendList } from "@/features/friends/api";
import { VoiceAudioSettings } from "@/features/settings/VoiceAudioSettings";
import {
  useOptionalSettingsModal,
  usePreferences,
  type SettingsSection,
} from "@/features/settings/settings-context";
import { ApiError, apiErrorMessage } from "@/lib/api/errors";
import type { Profile } from "@/lib/api/types";
import {
  displayName,
  fullUsername,
  publicIdentityLabel,
  publicUsername,
} from "@/lib/display-name";

interface NavItem {
  id: SettingsSection;
  label: string;
  category: "USER SETTINGS" | "APP SETTINGS";
  keywords: string[];
  icon: typeof User;
}

const SETTINGS_NAV_ITEMS: readonly NavItem[] = [
  {
    id: "my-account",
    label: "My Account",
    category: "USER SETTINGS",
    keywords: ["account", "username", "discriminator", "tag", "email", "identity", "verified"],
    icon: User,
  },
  {
    id: "profiles",
    label: "Profiles",
    category: "USER SETTINGS",
    keywords: ["profile", "display name", "avatar", "banner", "bio", "about me"],
    icon: UserCog,
  },
  {
    id: "privacy-safety",
    label: "Privacy & Safety",
    category: "USER SETTINGS",
    keywords: ["privacy", "safety", "blocked", "unblock", "direct messages", "permissions"],
    icon: Shield,
  },
  {
    id: "friend-requests",
    label: "Friend Requests",
    category: "USER SETTINGS",
    keywords: ["friends", "friend requests", "who can send", "everyone", "user tag"],
    icon: UserCheck,
  },
  {
    id: "voice-audio",
    label: "Voice & Audio",
    category: "APP SETTINGS",
    keywords: ["voice", "audio", "microphone", "speaker", "headphone", "volume", "mic test", "push to talk", "echo", "noise"],
    icon: Headphones,
  },
  {
    id: "notifications",
    label: "Notifications",
    category: "APP SETTINGS",
    keywords: ["notifications", "alerts", "desktop", "sounds", "messages"],
    icon: Bell,
  },
  {
    id: "appearance",
    label: "Appearance",
    category: "APP SETTINGS",
    keywords: ["appearance", "theme", "dark", "font size", "compact", "cozy", "message display", "spacing"],
    icon: Palette,
  },
  {
    id: "accessibility",
    label: "Accessibility",
    category: "APP SETTINGS",
    keywords: ["accessibility", "motion", "reduced motion", "contrast", "zoom", "scaling"],
    icon: Accessibility,
  },
];

export function SettingsPage() {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <div className="page-scroll">
      <div className="settings-standalone-shell">
        <SettingsWorkspace />
      </div>
    </div>
  );
}

export function SettingsModal({
  open,
  section,
  onSelectSection,
  onRequestClose,
  returnFocusRef,
}: {
  open: boolean;
  section: SettingsSection;
  onSelectSection: (next: SettingsSection) => void;
  onRequestClose: () => void;
  returnFocusRef: React.RefObject<HTMLElement | null>;
}) {
  const { session } = useAuth();
  const [hasUnsavedUsername, setHasUnsavedUsername] = useState(false);
  const [discardPrompt, setDiscardPrompt] = useState<
    { type: "close" } | { type: "section"; target: SettingsSection } | null
  >(null);

  if (!session) return null;

  function closeNow() {
    setHasUnsavedUsername(false);
    setDiscardPrompt(null);
    onRequestClose();
  }

  function attemptClose() {
    if (hasUnsavedUsername) {
      setDiscardPrompt({ type: "close" });
      return;
    }
    closeNow();
  }

  function attemptSelectSection(next: SettingsSection) {
    if (next === section) return;
    if (hasUnsavedUsername) {
      setDiscardPrompt({ type: "section", target: next });
      return;
    }
    setDiscardPrompt(null);
    onSelectSection(next);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) attemptClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="settings-modal-backdrop" />
        <Dialog.Content
          className="settings-modal-dialog"
          onEscapeKeyDown={(event) => {
            if (hasUnsavedUsername) {
              event.preventDefault();
              setDiscardPrompt({ type: "close" });
            }
          }}
          onPointerDownOutside={(event) => {
            if (hasUnsavedUsername) {
              event.preventDefault();
              setDiscardPrompt({ type: "close" });
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">User Settings</Dialog.Title>
          <Dialog.Description className="sr-only">
            Manage your Core account, profile, privacy, voice, appearance, and accessibility settings.
          </Dialog.Description>
          <SettingsWorkspace
            activeSection={section}
            onSelectSection={attemptSelectSection}
            onClose={attemptClose}
            onDirtyChange={setHasUnsavedUsername}
            isModal
          />
          {discardPrompt && (
            <div
              className="settings-unsaved-bar"
              role="alertdialog"
              aria-label="Unsaved changes"
            >
              <span>Careful — you have unsaved username changes!</span>
              <div className="settings-unsaved-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDiscardPrompt(null)}
                >
                  Keep Editing
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const currentPrompt = discardPrompt;
                    setHasUnsavedUsername(false);
                    setDiscardPrompt(null);
                    if (currentPrompt.type === "close") {
                      closeNow();
                    } else {
                      onSelectSection(currentPrompt.target);
                    }
                  }}
                >
                  Discard Changes
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SettingsWorkspace({
  activeSection: controlledSection,
  onSelectSection,
  onClose,
  onDirtyChange,
  isModal = false,
}: {
  activeSection?: SettingsSection;
  onSelectSection?: (next: SettingsSection) => void;
  onClose?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  isModal?: boolean;
}) {
  const modalContext = useOptionalSettingsModal();
  const [localSection, setLocalSection] = useState<SettingsSection>("my-account");
  const [search, setSearch] = useState("");
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const section = controlledSection ?? modalContext?.section ?? localSection;
  const selectSection = (next: SettingsSection) => {
    if (onSelectSection) onSelectSection(next);
    else if (modalContext) modalContext.selectSection(next);
    else setLocalSection(next);
  };

  useEffect(() => {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }
  }, [section]);

  const query = search.trim().toLowerCase();
  const filteredNav = useMemo(() => {
    if (!query) return SETTINGS_NAV_ITEMS;
    return SETTINGS_NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.keywords.some((kw) => kw.includes(query)),
    );
  }, [query]);

  const userSettingsItems = filteredNav.filter((item) => item.category === "USER SETTINGS");
  const appSettingsItems = filteredNav.filter((item) => item.category === "APP SETTINGS");
  const activeMeta =
    SETTINGS_NAV_ITEMS.find((item) => item.id === section) ?? SETTINGS_NAV_ITEMS[0]!;

  return (
    <div className="settings-modal-layout">
      <aside className="settings-sidebar" aria-label="Settings navigation">
        <SidebarUserHeader
          onEditProfile={() => selectSection("profiles")}
        />
        <div className="settings-sidebar-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search Settings"
            aria-label="Search settings"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              type="button"
              className="settings-search-clear"
              aria-label="Clear settings search"
              onClick={() => setSearch("")}
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>

        <nav className="settings-sidebar-nav" aria-label="Settings categories">
          {filteredNav.length === 0 ? (
            <p className="settings-nav-empty">No matching settings found.</p>
          ) : (
            <>
              {userSettingsItems.length > 0 && (
                <div className="settings-nav-group">
                  <h2 className="settings-nav-heading">User Settings</h2>
                  {userSettingsItems.map((item) => {
                    const Icon = item.icon;
                    const active = item.id === section;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={active ? "page" : undefined}
                        className={`settings-nav-item${active ? " is-active" : ""}`}
                        onClick={() => selectSection(item.id)}
                      >
                        <Icon size={17} aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {userSettingsItems.length > 0 && appSettingsItems.length > 0 && (
                <hr className="settings-sidebar-separator" />
              )}

              {appSettingsItems.length > 0 && (
                <div className="settings-nav-group">
                  <h2 className="settings-nav-heading">App Settings</h2>
                  {appSettingsItems.map((item) => {
                    const Icon = item.icon;
                    const active = item.id === section;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={active ? "page" : undefined}
                        className={`settings-nav-item${active ? " is-active" : ""}`}
                        onClick={() => selectSection(item.id)}
                      >
                        <Icon size={17} aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <hr className="settings-sidebar-separator" />
          <div className="settings-nav-group settings-signout">
            <LogoutButton />
          </div>
        </nav>
      </aside>

      <div className="settings-main-column">
        <header className="settings-main-header">
          <div className="settings-main-title-group">
            <h1>{activeMeta.label}</h1>
          </div>
          {(isModal || onClose || modalContext) && (
            <div className="settings-close-cluster">
              <button
                type="button"
                className="settings-close-button"
                aria-label="Close settings"
                onClick={() => {
                  if (onClose) onClose();
                  else modalContext?.closeSettings();
                }}
              >
                <X size={18} aria-hidden="true" />
              </button>
              <span className="settings-close-hint" aria-hidden="true">
                ESC
              </span>
            </div>
          )}
        </header>

        <div
          ref={contentScrollRef}
          className="settings-main-scroll"
          role="region"
          aria-label={`${activeMeta.label} content`}
          tabIndex={-1}
        >
          <div className="settings-content">
            {section === "my-account" && (
              <MyAccountSection
                onOpenProfiles={() => selectSection("profiles")}
                onDirtyChange={onDirtyChange}
              />
            )}
            {section === "profiles" && (
              <ProfilesSection onOpenAccount={() => selectSection("my-account")} />
            )}
            {section === "privacy-safety" && <PrivacySafetySection />}
            {section === "friend-requests" && <FriendRequestsSection />}
            {section === "voice-audio" && <VoiceAudioSettings />}
            {section === "notifications" && <NotificationsSection />}
            {section === "appearance" && <AppearanceSection />}
            {section === "accessibility" && <AccessibilitySection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarUserHeader({ onEditProfile }: { onEditProfile: () => void }) {
  const { session } = useAuth();
  const data = useOptionalAppData();
  const profile = useCurrentUser();
  const user = data?.configured && profile.isSuccess ? profile.data : undefined;

  const name = user
    ? displayName(user)
    : publicIdentityLabel(session?.user.name, session?.user.id) || "Core Member";
  const tag = user ? fullUsername(user) || publicUsername(user) : "";
  const avatarImage = user ? user.avatar_url : session?.user.image;

  return (
    <div className="settings-sidebar-profile">
      <button
        type="button"
        className="settings-sidebar-profile-trigger"
        onClick={onEditProfile}
        title="View Profiles settings"
      >
        <UserAvatar
          user={{ name, email: "", image: avatarImage }}
          className="size-10 shrink-0"
        />
        <div className="min-w-0 flex-1 text-left">
          <p className="settings-sidebar-profile-name">{name}</p>
          <p className="settings-sidebar-profile-tag">
            {tag || "Edit Profile"}
          </p>
        </div>
      </button>
    </div>
  );
}

function MyAccountSection({
  onOpenProfiles,
  onDirtyChange,
}: {
  onOpenProfiles: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const profile = useCurrentUser();
  const data = useOptionalAppData();

  if (data?.configurationError)
    return <ApiNotice error={new ApiError("configuration")} />;
  if (!profile.isSuccess) return <ApplicationProfileState />;

  return (
    <AccountProfileCard
      user={profile.data}
      onOpenProfiles={onOpenProfiles}
      onDirtyChange={onDirtyChange}
    />
  );
}

function AccountProfileCard({
  user,
  onOpenProfiles,
  onDirtyChange,
}: {
  user: Profile;
  onOpenProfiles: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [editingUsername, setEditingUsername] = useState(false);
  const name = displayName(user);
  const fullTag = fullUsername(user);
  const usernameOnly = publicUsername(user) || "Not set";
  const userTagOnly = user.discriminator ? `#${user.discriminator}` : "Unavailable";

  useEffect(() => {
    return () => {
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);

  return (
    <div className="settings-section-stack">
      <section className="settings-panel settings-account-card" aria-label="Account profile">
        <div className="settings-account-banner" aria-hidden="true" />
        <div className="settings-profile">
          <div className="settings-account-avatar-wrap">
            <UserAvatar
              user={{
                name,
                email: user.email,
                image: user.avatar_url,
              }}
              className="size-16"
            />
          </div>
          <div className="settings-profile-identity">
            <div className="flex flex-wrap items-center gap-2">
              <h2>{name}</h2>
              <span className="settings-verified-pill">
                <ShieldCheck
                  className="text-online shrink-0"
                  size={15}
                  aria-label="Application profile verified by Core"
                />
                <span>Verified</span>
              </span>
            </div>
            <p className="settings-profile-tag">{fullTag || usernameOnly}</p>
            <p className="settings-profile-email">{user.email || "No email available"}</p>
          </div>
          <div className="settings-profile-actions">
            <CopyUsername profile={user} />
          </div>
        </div>

        <div className="settings-account-details">
          <dl className="settings-detail-list">
            <div className="settings-detail-row">
              <div className="min-w-0">
                <dt>Display name</dt>
                <dd>{publicIdentityLabel(user.display_name, user.id) || "Not set"}</dd>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenProfiles}
              >
                View Profile
              </Button>
            </div>

            <div className="settings-detail-row">
              <div className="min-w-0">
                <dt>Username</dt>
                <dd>{usernameOnly}</dd>
              </div>
              <Button
                type="button"
                variant={editingUsername ? "ghost" : "outline"}
                size="sm"
                aria-expanded={editingUsername}
                onClick={() => {
                  if (editingUsername) {
                    onDirtyChange?.(false);
                    setEditingUsername(false);
                  } else {
                    setEditingUsername(true);
                  }
                }}
              >
                {editingUsername ? "Close" : "Edit"}
              </Button>
            </div>

            {editingUsername && (
              <div className="settings-inline-editor">
                <UsernameSettings
                  profile={user}
                  compact
                  onDirtyChange={onDirtyChange}
                  onCancel={() => setEditingUsername(false)}
                  onSuccess={() => setEditingUsername(false)}
                />
              </div>
            )}

            <div className="settings-detail-row">
              <div className="min-w-0">
                <dt>User tag</dt>
                <dd>{userTagOnly}</dd>
              </div>
              <span className="settings-field-meta">Fixed 4-digit tag</span>
            </div>

            <div className="settings-detail-row">
              <div className="min-w-0">
                <dt>Email address</dt>
                <dd>{user.email || "Not available"}</dd>
              </div>
              <span className="settings-field-meta">Managed by sign-in</span>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

function ProfilesSection({ onOpenAccount }: { onOpenAccount: () => void }) {
  const profile = useCurrentUser();
  const data = useOptionalAppData();

  if (data?.configurationError)
    return <ApiNotice error={new ApiError("configuration")} />;
  if (!profile.isSuccess) return <ApplicationProfileState />;

  const user = profile.data;
  const name = displayName(user);
  const handle = fullUsername(user) || publicUsername(user);

  return (
    <div className="settings-section-stack">
      <p className="settings-description">
        Preview how your identity appears across Core communities and member lists.
      </p>

      <div className="settings-profiles-grid">
        <div className="settings-group">
          <div className="settings-field">
            <span className="settings-label">Display Name</span>
            <div className="settings-readonly-box">
              <span>{publicIdentityLabel(user.display_name, user.id) || "Not set"}</span>
              <span className="settings-badge-unavailable">Read-only</span>
            </div>
            <p className="settings-field-hint">
              Your display name is initialized from your verified Core account. Your public username can be updated in My Account without changing your four-digit tag.
            </p>
          </div>

          <div className="settings-field">
            <span className="settings-label">Public Handle</span>
            <div className="settings-readonly-box">
              <span>{handle || "Not set"}</span>
              <Button type="button" variant="outline" size="sm" onClick={onOpenAccount}>
                Edit Username
              </Button>
            </div>
          </div>

          <div className="settings-field">
            <span className="settings-label">Avatar & Profile Banner</span>
            <div className="settings-disabled-row">
              <div>
                <strong>Custom media uploads unavailable</strong>
                <p>Custom avatar images, profile banners, and About Me biographies are not supported yet.</p>
              </div>
              <span className="settings-badge-unavailable">Unavailable</span>
            </div>
          </div>
        </div>

        <div className="settings-profile-preview-wrap" aria-label="Profile card preview">
          <span className="settings-label">Preview</span>
          <div className="settings-profile-preview-card">
            <div className="member-profile-banner" aria-hidden="true" />
            <div className="settings-preview-avatar">
              <UserAvatar
                user={{ name, email: user.email, image: user.avatar_url }}
                className="size-16"
              />
            </div>
            <div className="settings-preview-body">
              <h3>{name}</h3>
              {handle && <p className="settings-preview-handle">{handle}</p>}
              <div className="mt-3">
                <CopyUsername profile={user} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacySafetySection() {
  const data = useOptionalAppData();
  const profile = useCurrentUser();
  const counts = useFriendCounts();
  const blockedQuery = useFriendList("blocked", Boolean(data?.ready && profile.isSuccess));
  const mutation = useFriendAction();

  if (data?.configurationError)
    return <ApiNotice error={new ApiError("configuration")} />;
  if (!profile.isSuccess) return <ApplicationProfileState />;

  const items = blockedQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const blockedUsers = [...new Map(items.map((item) => [item.id, item])).values()];
  const totalBlocked = counts.data?.blocked ?? blockedUsers.length;

  return (
    <div className="settings-section-stack">
      <section className="settings-group" aria-label="Account privacy enforcement">
        <h3 className="settings-group-title">Server & Messaging Privacy</h3>
        <p className="settings-description">
          All channel access and relationship permissions are strictly enforced by the Core Rust backend.
        </p>
        <div className="settings-disabled-list">
          <div className="settings-disabled-row">
            <div>
              <strong>Direct Messages</strong>
              <p>Direct messaging between members is not available yet.</p>
            </div>
            <span className="settings-badge-unavailable">Unavailable</span>
          </div>
          <div className="settings-disabled-row">
            <div>
              <strong>Channel Access Controls</strong>
              <p>Private channel visibility and role overrides are enforced per community.</p>
            </div>
            <span className="settings-field-meta">Backend enforced</span>
          </div>
        </div>
      </section>

      <hr className="settings-divider" />

      <section className="settings-group" aria-label="Blocked users">
        <div className="flex items-center justify-between gap-2">
          <h3 className="settings-group-title">
            Blocked Users — {totalBlocked}
          </h3>
        </div>
        <p className="settings-description">
          Blocked users cannot send you friend requests or maintain a friendship with your account.
        </p>

        {blockedQuery.isPending ? (
          <ApiNotice loading="Loading blocked users…" />
        ) : blockedQuery.isError && !blockedQuery.data ? (
          <ApiNotice
            error={blockedQuery.error}
            onRetry={() => void blockedQuery.refetch()}
          />
        ) : blockedUsers.length === 0 ? (
          <div className="settings-empty-box">
            <Users size={24} aria-hidden="true" />
            <p>You haven’t blocked anyone.</p>
          </div>
        ) : (
          <ul className="friends-list settings-blocked-list">
            {blockedUsers.map((blockedProfile) => (
              <li key={blockedProfile.id} className="friend-row">
                <MemberIdentity profile={blockedProfile} />
                <div className="friend-row-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({ action: "unblock", id: blockedProfile.id })
                    }
                  >
                    Unblock
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {mutation.error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {apiErrorMessage(mutation.error)}
          </p>
        )}
        {blockedQuery.hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={blockedQuery.isFetching}
            onClick={() => void blockedQuery.fetchNextPage()}
          >
            {blockedQuery.isFetching ? "Loading…" : "Load more"}
          </Button>
        )}
      </section>
    </div>
  );
}

function FriendRequestsSection() {
  const data = useOptionalAppData();
  const profile = useCurrentUser();

  if (data?.configurationError)
    return <ApiNotice error={new ApiError("configuration")} />;
  if (!profile.isSuccess) return <ApplicationProfileState />;

  const user = profile.data;
  const tag = fullUsername(user);

  return (
    <div className="settings-section-stack">
      <section className="settings-group" aria-label="Friend request policy">
        <h3 className="settings-group-title">Who Can Send You a Friend Request</h3>
        <p className="settings-description">
          Core resolves friend requests using your complete public username and four-digit user tag ({tag || "Username#0000"}). Accounts you block are automatically prevented from sending requests by the backend.
        </p>

        <div className="settings-disabled-list">
          <div className="settings-disabled-row">
            <div>
              <strong>Everyone with your full Core username</strong>
              <p>Anyone who knows your exact {tag || "Username#0000"} tag can send a friend request unless blocked.</p>
            </div>
            <span className="settings-verified-pill">Active</span>
          </div>
          <div className="settings-disabled-row">
            <div>
              <strong>Granular Request Filters</strong>
              <p>Filtering friend requests by Server Members or Friends of Friends is not supported by the backend yet.</p>
            </div>
            <span className="settings-badge-unavailable">Unavailable</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function NotificationsSection() {
  const [permission, setPermission] = useState<string>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission;
  });
  const [feedback, setFeedback] = useState("");

  async function requestBrowserPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        setFeedback("Browser desktop notification permission granted.");
      } else if (result === "denied") {
        setFeedback("Browser notifications are blocked in your browser settings.");
      }
    } catch {
      setFeedback("Could not request notification permission.");
    }
  }

  return (
    <div className="settings-section-stack">
      <section className="settings-group" aria-label="Notification status">
        <h3 className="settings-group-title">Desktop Notifications</h3>
        <p className="settings-description">
          Real-time push notifications and notification sounds require live event delivery and are not connected yet.
        </p>

        <div className="settings-disabled-list">
          <div className="settings-disabled-row">
            <div>
              <strong>Browser Permission Status</strong>
              <p>
                {permission === "unsupported"
                  ? "This browser does not support desktop notifications."
                  : permission === "granted"
                    ? "Desktop notification permission is granted for this origin."
                    : permission === "denied"
                      ? "Desktop notifications are blocked by your browser settings."
                      : "Permission has not been requested yet."}
              </p>
            </div>
            {permission === "default" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void requestBrowserPermission()}
              >
                Allow Browser Notifications
              </Button>
            ) : (
              <span className="settings-field-meta capitalize">{permission}</span>
            )}
          </div>

          <div className="settings-disabled-row">
            <div>
              <strong>Message & Friend Request Alerts</strong>
              <p>Server-pushed notification events and notification sounds are unavailable.</p>
            </div>
            <span className="settings-badge-unavailable">Unavailable</span>
          </div>
        </div>
        {feedback && (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            {feedback}
          </p>
        )}
      </section>
    </div>
  );
}

function AppearanceSection() {
  const { preferences, updatePreferences, resetPreferences } = usePreferences();
  const id = useId();

  return (
    <div className="settings-section-stack">
      <section className="settings-group" aria-labelledby={`${id}-theme`}>
        <h3 id={`${id}-theme`} className="settings-group-title">Theme</h3>
        <p className="settings-description">
          Core uses its signature dark charcoal and crimson palette.
        </p>
        <div className="settings-choice-grid">
          <div className="settings-choice-card is-selected" aria-current="true">
            <Palette size={18} aria-hidden="true" />
            <div>
              <strong>Core Dark Charcoal</strong>
              <span>Default dark theme with Core red accents</span>
            </div>
          </div>
        </div>
      </section>

      <hr className="settings-divider" />

      <section className="settings-group" aria-labelledby={`${id}-display`}>
        <h3 id={`${id}-display`} className="settings-group-title">Message Display</h3>
        <p className="settings-description">
          Adjust how chat messages are spaced in community channels.
        </p>
        <div className="settings-choice-grid" role="radiogroup" aria-labelledby={`${id}-display`}>
          <button
            type="button"
            role="radio"
            aria-checked={preferences.messageDisplay === "cozy"}
            className={`settings-choice-card${preferences.messageDisplay === "cozy" ? " is-selected" : ""}`}
            onClick={() => updatePreferences({ messageDisplay: "cozy" })}
          >
            <div>
              <strong>Cozy</strong>
              <span>Modern, comfortable spacing with full avatars</span>
            </div>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={preferences.messageDisplay === "compact"}
            className={`settings-choice-card${preferences.messageDisplay === "compact" ? " is-selected" : ""}`}
            onClick={() => updatePreferences({ messageDisplay: "compact" })}
          >
            <div>
              <strong>Compact</strong>
              <span>Tighter vertical spacing to fit more messages onscreen</span>
            </div>
          </button>
        </div>
      </section>

      <hr className="settings-divider" />

      <section className="settings-group" aria-labelledby={`${id}-font-size`}>
        <h3 id={`${id}-font-size`} className="settings-group-title">Chat Font Scaling</h3>
        <p className="settings-description">
          Change the text size of messages in community channels.
        </p>
        <div className="settings-choice-grid" role="radiogroup" aria-labelledby={`${id}-font-size`}>
          {(
            [
              ["14px", "14px (Default)"],
              ["15px", "15px (Medium)"],
              ["16px", "16px (Large)"],
            ] as const
          ).map(([size, label]) => (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={preferences.chatFontSize === size}
              className={`settings-choice-card${preferences.chatFontSize === size ? " is-selected" : ""}`}
              onClick={() => updatePreferences({ chatFontSize: size })}
            >
              <div>
                <strong>{label}</strong>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="pt-2">
        <Button type="button" variant="outline" size="sm" onClick={resetPreferences}>
          Reset Appearance & Accessibility Defaults
        </Button>
      </div>
    </div>
  );
}

function AccessibilitySection() {
  const { preferences, updatePreferences } = usePreferences();
  const id = useId();

  return (
    <div className="settings-section-stack">
      <section className="settings-group" aria-labelledby={`${id}-motion`}>
        <h3 id={`${id}-motion`} className="settings-group-title">Reduced Motion</h3>
        <p className="settings-description">
          Control transitions and animations across dialogs, menus, and indicators.
        </p>
        <div className="settings-choice-grid" role="radiogroup" aria-labelledby={`${id}-motion`}>
          {(
            [
              ["system", "Sync with system", "Follows your operating system prefers-reduced-motion setting"],
              ["reduce", "Reduce motion", "Minimizes UI transitions and animations"],
              ["full", "Standard motion", "Keeps smooth interface transitions enabled"],
            ] as const
          ).map(([value, title, subtitle]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={preferences.motion === value}
              className={`settings-choice-card${preferences.motion === value ? " is-selected" : ""}`}
              onClick={() => updatePreferences({ motion: value })}
            >
              <div>
                <strong>{title}</strong>
                <span>{subtitle}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <hr className="settings-divider" />

      <section className="settings-group" aria-labelledby={`${id}-contrast`}>
        <h3 id={`${id}-contrast`} className="settings-group-title">Contrast & Readability</h3>
        <div className="settings-disabled-list">
          <div className="settings-disabled-row">
            <div>
              <strong>Enhanced Borders & Text Contrast</strong>
              <p>Increases border visibility and muted text brightness across Core.</p>
            </div>
            <Button
              type="button"
              variant={preferences.contrast ? "default" : "outline"}
              size="sm"
              aria-pressed={preferences.contrast}
              onClick={() => updatePreferences({ contrast: !preferences.contrast })}
            >
              {preferences.contrast ? "Enabled" : "Enable"}
            </Button>
          </div>
        </div>
      </section>

      <hr className="settings-divider" />

      <section className="settings-group" aria-labelledby={`${id}-zoom`}>
        <h3 id={`${id}-zoom`} className="settings-group-title">Interface Scale</h3>
        <p className="settings-description">
          Adjust overall interface sizing.
        </p>
        <div className="settings-choice-grid" role="radiogroup" aria-labelledby={`${id}-zoom`}>
          {(
            [
              ["90", "90% (Compact)"],
              ["100", "100% (Default)"],
              ["110", "110% (Comfortable)"],
            ] as const
          ).map(([scale, label]) => (
            <button
              key={scale}
              type="button"
              role="radio"
              aria-checked={preferences.zoom === scale}
              className={`settings-choice-card${preferences.zoom === scale ? " is-selected" : ""}`}
              onClick={() => updatePreferences({ zoom: scale })}
            >
              <div>
                <strong>{label}</strong>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
