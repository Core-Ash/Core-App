export type AvatarTone = "rose" | "teal" | "amber" | "violet" | "slate";
export type CommunityView = "channel" | "overview" | "events" | "members";
export interface CommunityMember {
  id: string;
  name: string;
  initials: string;
  avatar?: string;
  tone: AvatarTone;
  profile?: PublicProfile | null;
}
export interface ChatMessageData {
  id: string;
  author: CommunityMember;
  body: string;
  createdAt: string;
  edited?: boolean;
  deleted?: boolean;
}
import type { PublicProfile } from "@/lib/api/types";
