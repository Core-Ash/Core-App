import { useState, useEffect } from "react";
import {
  X,
  Trash2,
  ExternalLink,
  Shield,
  Smile,
  Image,
  Volume2,
  Users,
  Link2,
  KeyRound,
  Bot,
  Box,
  ShieldCheck,
  History,
  Ban,
  ShieldAlert,
  Users2,
  FileText,
  Tag,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerSettings, useUpdateServerSettings } from "./api";
import { ServerProfileSettings } from "./ServerProfileSettings";
import { ServerTagSettings } from "./ServerTagSettings";
import { OnboardingSettings } from "./OnboardingSettings";
import { BoostPerksSettings } from "./BoostPerksSettings";
import { EmojiSettings, StickerSettings, SoundboardSettings } from "./ExpressionSettings";
import { MemberSettings } from "./MemberSettings";
import { RoleSettings } from "./RoleSettings";
import { InviteSettings } from "./InviteSettings";
import { AccessSettings } from "./AccessSettings";
import { IntegrationSettings, AppDirectory } from "./AppsSettings";
import { SafetySettings, AuditLogSettings, BanSettings, AutoModSettings } from "./ModerationSettings";
import { CommunitySettings, TemplateSettings, DeleteServerSettings } from "./CommunityAndOtherSettings";
import type { ServerSettingsSection, UpdateServerSettingsInput } from "./types";
import type { Community, Profile } from "@/lib/api/types";

interface NavItemConfig {
  id: ServerSettingsSection;
  label: string;
  icon?: typeof Shield;
  destructive?: boolean;
  external?: boolean;
}

interface NavGroupConfig {
  category?: string;
  items: NavItemConfig[];
}

const NAV_GROUPS: readonly NavGroupConfig[] = [
  {
    category: "Server Settings",
    items: [
      { id: "profile", label: "Server Profile", icon: Shield },
      { id: "tag", label: "Server Tag", icon: Tag },
      { id: "onboarding", label: "Onboarding", icon: UserCheck },
      { id: "boost", label: "Boost Perks", icon: Sparkles },
    ],
  },
  {
    category: "Expression",
    items: [
      { id: "emojis", label: "Emojis", icon: Smile },
      { id: "stickers", label: "Stickers", icon: Image },
      { id: "soundboard", label: "Soundboard", icon: Volume2 },
    ],
  },
  {
    category: "People",
    items: [
      { id: "members", label: "Members", icon: Users },
      { id: "roles", label: "Roles", icon: Shield },
      { id: "invites", label: "Invites", icon: Link2 },
      { id: "access", label: "Access", icon: KeyRound },
    ],
  },
  {
    category: "Apps",
    items: [
      { id: "integrations", label: "Integrations", icon: Bot },
      { id: "app-directory", label: "App Directory", icon: Box, external: true },
    ],
  },
  {
    category: "Moderation",
    items: [
      { id: "safety", label: "Safety Setup", icon: ShieldCheck },
      { id: "audit-log", label: "Audit Log", icon: History },
      { id: "bans", label: "Bans", icon: Ban },
      { id: "automod", label: "AutoMod", icon: ShieldAlert },
    ],
  },
  {
    category: "Community",
    items: [
      { id: "community", label: "Community Settings", icon: Users2 },
    ],
  },
  {
    category: "Other",
    items: [
      { id: "template", label: "Server Template", icon: FileText },
      { id: "delete", label: "Delete Server", icon: Trash2, destructive: true },
    ],
  },
];

export function ServerSettingsLayout({
  community,
  profile,
  initialSection = "profile",
  onClose,
}: {
  community: Community;
  profile: Profile;
  initialSection?: ServerSettingsSection;
  onClose: () => void;
}) {
  const [section, setSection] = useState<ServerSettingsSection>(initialSection);
  const [draft, setDraft] = useState<UpdateServerSettingsInput>({});
  const [discardPrompt, setDiscardPrompt] = useState<ServerSettingsSection | "close" | null>(null);

  const settingsQuery = useServerSettings(community.id);
  const updateSettings = useUpdateServerSettings(community.id);

  const hasUnsavedChanges = Object.keys(draft).length > 0;

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (hasUnsavedChanges) {
          setDiscardPrompt("close");
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, onClose]);

  const handleSelectSection = (next: ServerSettingsSection) => {
    if (hasUnsavedChanges && next !== section) {
      setDiscardPrompt(next);
    } else {
      setSection(next);
    }
  };

  const handleSaveChanges = () => {
    updateSettings.mutate(draft, {
      onSuccess: () => {
        setDraft({});
      },
    });
  };

  const handleResetChanges = () => {
    setDraft({});
    setDiscardPrompt(null);
  };

  const isOwner = settingsQuery.data?.owner_id === profile.id || community.owner_id === profile.id;
  const canManage = isOwner || Boolean(settingsQuery.data?.permissions?.manage_community);

  // Fallback data when settings are loading
  const fallbackSettings = {
    id: community.id,
    name: community.name,
    owner_id: community.owner_id,
    description: null,
    icon_url: null,
    banner_url: null,
    highlights: [],
    tag: null,
    tag_color: null,
    tag_badge: null,
    tag_enabled: false,
    community_enabled: false,
    rules_channel_id: null,
    announcement_channel_id: null,
    safety_verification_level: "none" as const,
    safety_spam_protection: true,
    safety_mention_limit: 5,
    member_count: 1,
    created_at: new Date().toISOString(),
    permissions: {
      owner: isOwner,
      manage_community: canManage,
      manage_roles: canManage,
      manage_members: canManage,
      manage_bans: canManage,
      manage_invites: true,
      view_audit_log: canManage,
      manage_emojis: canManage,
    },
  };

  const currentSettings = settingsQuery.data ?? fallbackSettings;

  return (
    <div className="server-settings-viewport" role="region" aria-label={`${community.name} server settings`}>
      <div className="server-settings-container">
        {/* Left Navigation Sidebar */}
        <div className="server-settings-sidebar-wrapper">
          <aside className="server-settings-sidebar" aria-label="Server settings navigation">
            {/* Server Title Header */}
            <div className="server-settings-sidebar-header">
              <h1 className="truncate font-bold text-base text-foreground">
                {draft.name ?? currentSettings.name}
              </h1>
            </div>

            {/* Navigation Links Grouped */}
            <nav className="server-settings-nav space-y-4" aria-label="Settings categories">
            {NAV_GROUPS.map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-0.5">
                {group.category && (
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                    {group.category}
                  </div>
                )}
                {group.items.map((item) => {
                  const isActive = section === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="link"
                      onClick={() => handleSelectSection(item.id)}
                      className={`server-settings-nav-item ${
                        isActive ? "is-active" : ""
                      } ${item.destructive ? "is-destructive" : ""}`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {Icon && <Icon className="size-4 shrink-0" />}
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.external && <ExternalLink className="size-3.5 opacity-60 ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>
      </div>

      {/* Center / Main Settings Area */}
      <div className="server-settings-main-wrapper">
        <main className="server-settings-main">
          {/* Top Right Close Button with ESC */}
          <div className="server-settings-close-anchor">
            <button
              type="button"
              className="server-settings-close-btn"
              aria-label="Back to channels"
              role="link"
              onClick={() => {
                if (hasUnsavedChanges) {
                  setDiscardPrompt("close");
                } else {
                  onClose();
                }
              }}
            >
              <div className="server-settings-close-circle">
                <X className="size-4" />
              </div>
              <span className="server-settings-close-text">ESC</span>
            </button>
          </div>

          {/* Active Page Content */}
          <div className="server-settings-content">
            {section === "profile" && (
              <ServerProfileSettings
                settings={currentSettings}
                canManage={canManage}
                draft={draft}
                onChangeDraft={setDraft}
              />
            )}
            {section === "tag" && (
              <ServerTagSettings
                settings={currentSettings}
                canManage={canManage}
                draft={draft}
                onChangeDraft={setDraft}
              />
            )}
            {section === "onboarding" && (
              <OnboardingSettings
                settings={currentSettings}
                canManage={canManage}
              />
            )}
            {section === "boost" && (
              <BoostPerksSettings settings={currentSettings} />
            )}
            {section === "emojis" && (
              <EmojiSettings settings={currentSettings} canManage={canManage} />
            )}
            {section === "stickers" && (
              <StickerSettings settings={currentSettings} canManage={canManage} />
            )}
            {section === "soundboard" && (
              <SoundboardSettings settings={currentSettings} canManage={canManage} />
            )}
            {section === "members" && (
              <MemberSettings settings={currentSettings} canManage={canManage} />
            )}
            {section === "roles" && (
              <RoleSettings settings={currentSettings} canManage={canManage} />
            )}
            {section === "invites" && (
              <InviteSettings settings={currentSettings} canManage={canManage} />
            )}
            {section === "access" && (
              <AccessSettings
                settings={currentSettings}
                canManage={canManage}
                draft={draft}
                onChangeDraft={setDraft}
              />
            )}
            {section === "integrations" && (
              <IntegrationSettings settings={currentSettings} />
            )}
            {section === "app-directory" && (
              <AppDirectory settings={currentSettings} />
            )}
            {section === "safety" && (
              <SafetySettings
                settings={currentSettings}
                canManage={canManage}
                draft={draft}
                onChangeDraft={setDraft}
              />
            )}
            {section === "audit-log" && (
              <AuditLogSettings settings={currentSettings} />
            )}
            {section === "bans" && (
              <BanSettings settings={currentSettings} canManage={canManage} />
            )}
            {section === "automod" && (
              <AutoModSettings settings={currentSettings} canManage={canManage} />
            )}
            {section === "community" && (
              <CommunitySettings
                settings={currentSettings}
                canManage={canManage}
                draft={draft}
                onChangeDraft={setDraft}
              />
            )}
            {section === "template" && (
              <TemplateSettings settings={currentSettings} canManage={canManage} />
            )}
            {section === "delete" && (
              <DeleteServerSettings
                settings={currentSettings}
                isOwner={isOwner}
                onDeleted={onClose}
              />
            )}
          </div>
        </main>
      </div>
    </div>

      {/* Floating Bottom Unsaved Changes Bar */}
      {hasUnsavedChanges && (
        <div className="server-settings-unsaved-bar" role="alert" aria-live="polite">
          <span className="text-sm font-medium text-white">
            Careful — you have unsaved changes!
          </span>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={handleResetChanges}
              disabled={updateSettings.isPending}
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              onClick={handleSaveChanges}
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Discard Warning Modal */}
      {discardPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-popover border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="font-bold text-foreground">Unsaved Changes</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You have unsaved changes on this page. Are you sure you want to discard them?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
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
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                size="sm"
                onClick={() => {
                  const target = discardPrompt;
                  setDraft({});
                  setDiscardPrompt(null);
                  if (target === "close") {
                    onClose();
                  } else {
                    setSection(target);
                  }
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
