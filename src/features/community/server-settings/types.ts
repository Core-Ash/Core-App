export type ServerSettingsSection =
  | "profile"
  | "tag"
  | "onboarding"
  | "boost"
  | "emojis"
  | "stickers"
  | "soundboard"
  | "members"
  | "roles"
  | "invites"
  | "access"
  | "integrations"
  | "app-directory"
  | "safety"
  | "audit-log"
  | "bans"
  | "automod"
  | "community"
  | "template"
  | "delete";

export interface ServerSettingsPermissions {
  owner: boolean;
  administrator?: boolean;
  manage_community: boolean;
  manage_roles: boolean;
  manage_members: boolean;
  manage_bans: boolean;
  manage_invites: boolean;
  view_audit_log: boolean;
  manage_emojis: boolean;
}

export interface ServerSettingsData {
  id: string;
  name: string;
  owner_id: string;
  description: string | null;
  icon_url: string | null;
  banner_url: string | null;
  highlights: string[];
  tag: string | null;
  tag_color: string | null;
  tag_badge: string | null;
  tag_enabled: boolean;
  community_enabled: boolean;
  rules_channel_id: string | null;
  announcement_channel_id: string | null;
  safety_verification_level: "none" | "low" | "medium" | "high";
  safety_spam_protection: boolean;
  safety_mention_limit: number;
  member_count: number;
  created_at: string;
  permissions: ServerSettingsPermissions;
}

export interface UpdateServerSettingsInput {
  name?: string;
  description?: string | null;
  icon_url?: string | null;
  banner_url?: string | null;
  highlights?: string[];
  tag?: string | null;
  tag_color?: string | null;
  tag_badge?: string | null;
  tag_enabled?: boolean;
  community_enabled?: boolean;
  rules_channel_id?: string | null;
  announcement_channel_id?: string | null;
  safety_verification_level?: "none" | "low" | "medium" | "high";
  safety_spam_protection?: boolean;
  safety_mention_limit?: number;
}

export interface ServerRoleData {
  id: string;
  name: string;
  color: string | null;
  position: number;
  permissions: string[];
  member_count: number;
  hoist?: boolean;
  mentionable?: boolean;
  is_default?: boolean;
}

export interface RoleMemberData {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  custom_status: string | null;
}

export interface ServerBanData {
  user_id: string;
  reason: string | null;
  created_at: string;
  banned_by: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banned_by_name: string | null;
}

export interface ServerAuditLogData {
  id: string;
  action_type: string;
  target_id: string | null;
  target_type: string | null;
  changes: Record<string, unknown>;
  created_at: string;
  actor: {
    id: string | null;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface AutoModRuleData {
  id: string;
  name: string;
  enabled: boolean;
  trigger_type: "keyword" | "spam" | "mention";
  trigger_metadata: {
    keywords?: string[];
    [key: string]: unknown;
  };
  actions: string[];
  created_at: string;
}

export interface ServerEmojiData {
  id: string;
  name: string;
  url: string;
  created_at: string;
}

export interface ServerStickerData {
  id: string;
  name: string;
  description: string | null;
  url: string;
  created_at: string;
}

export interface ServerSoundData {
  id: string;
  name: string;
  emoji: string | null;
  sound_url: string;
  created_at: string;
}

export interface ServerOnboardingData {
  enabled: boolean;
  welcome_message: string | null;
  default_channels: string[];
  rules: string | null;
}

export interface ServerTemplateData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
  creator_name: string | null;
}

export const PRESET_BANNERS = [
  { id: "sand", label: "Sand", gradient: "linear-gradient(135deg, #d4a373, #faedcd)" },
  { id: "pink", label: "Pink", gradient: "linear-gradient(135deg, #ff007f, #ff758c)" },
  { id: "core-red", label: "Core Red", gradient: "linear-gradient(135deg, #f04450, #990011)" },
  { id: "orange", label: "Orange", gradient: "linear-gradient(135deg, #ff7e5f, #feb47b)" },
  { id: "amber", label: "Amber", gradient: "linear-gradient(135deg, #f7971e, #ffd200)" },
  { id: "purple", label: "Purple", gradient: "linear-gradient(135deg, #654ea3, #eaafc8)" },
  { id: "blue", label: "Blue", gradient: "linear-gradient(135deg, #00c6ff, #0072ff)" },
  { id: "cyan", label: "Cyan", gradient: "linear-gradient(135deg, #43cea2, #185a9d)" },
  { id: "green", label: "Green", gradient: "linear-gradient(135deg, #56ab2f, #a8e063)" },
  { id: "charcoal", label: "Charcoal", gradient: "linear-gradient(135deg, #232526, #414345)" },
];
