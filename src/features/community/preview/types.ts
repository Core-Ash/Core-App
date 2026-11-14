import type {
  AvatarTone,
  CommunityMember,
  ChatMessageData,
  MessageReaction,
} from "@/features/community/types";
export type { AvatarTone, CommunityView } from "@/features/community/types";
export type PreviewMember = CommunityMember;

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

export type PreviewReaction = MessageReaction;
export type PreviewMessage = ChatMessageData;
