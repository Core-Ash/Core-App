import type { PresenceStatus } from "@/components/ui/status-indicator";

export type AvatarTone = "rose" | "teal" | "amber" | "violet" | "slate";

export interface PreviewMember {
  id: string;
  name: string;
  initials: string;
  avatar?: string;
  activityAvatar?: string;
  mobile?: boolean;
  tone: AvatarTone;
  status: PresenceStatus;
  game?: string;
  role?: string;
}

export interface PreviewChannel {
  id: string;
  name: string;
  description: string;
}

export interface PreviewCommunity {
  id: string;
  name: string;
  initials: string;
  tagline: string;
  description: string;
  tone: AvatarTone;
  emblem: "gamepad" | "dragon" | "mountain";
  memberIds: readonly string[];
  channels: readonly PreviewChannel[];
  voiceChannels: readonly {
    id: string;
    name: string;
    sampleMemberIds: readonly string[];
  }[];
}

export interface PreviewReaction {
  emoji: string;
  label: string;
  count: number;
}

export interface PreviewMessage {
  id: string;
  author: PreviewMember;
  body: string;
  createdAt: string;
  timestampLabel?: string;
  attachment?: { src: string; alt: string };
  reactions?: readonly PreviewReaction[];
  local?: boolean;
}

export type CommunityView = "channel" | "overview" | "events" | "members";
