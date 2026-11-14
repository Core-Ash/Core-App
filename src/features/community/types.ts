import type { PresenceStatus } from "@/components/ui/status-indicator";

export type AvatarTone = "rose" | "teal" | "amber" | "violet" | "slate";
export type CommunityView = "channel" | "overview" | "events" | "members";
export interface CommunityMember {
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
export interface MessageReaction {
  emoji: string;
  label: string;
  count: number;
}
export interface ChatMessageData {
  id: string;
  author: CommunityMember;
  body: string;
  createdAt: string;
  timestampLabel?: string;
  attachment?: { src: string; alt: string };
  reactions?: readonly MessageReaction[];
  local?: boolean;
  edited?: boolean;
  deleted?: boolean;
}
