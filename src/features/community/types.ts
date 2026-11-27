import type {
  ForwardedMessageSnapshot,
  MessageAttachment,
  MessageReactionGroup,
  MessageReplyReference,
  PublicProfile,
  ThreadSummary,
} from "@/lib/api/types";
import type { Mention } from "@/features/mentions/model";
export type AvatarTone = "rose" | "teal" | "amber" | "violet" | "slate";
export type CommunityView = "channel" | "overview" | "events" | "members" | "invites";
export interface CommunityMember {
  id: string;
  name: string;
  initials: string;
  avatar?: string;
  tone: AvatarTone;
  profile?: PublicProfile | null;
}
export interface ChatMessageData {
  mentions?: Mention[];
  currentUserId?: string;
  id: string;
  renderKey?: string;
  delivery?: "pending" | "failed";
  deliveryError?: string;
  onRetry?: () => void;
  author: CommunityMember;
  body: string;
  createdAt: string;
  edited?: boolean;
  deleted?: boolean;
  attachments?: MessageAttachment[];
  reactions?: MessageReactionGroup[];
  replyToMessageId?: string | null;
  replyMention?: boolean;
  replyTo?: MessageReplyReference | null;
  forwarded?: ForwardedMessageSnapshot | null;
  threadId?: string | null;
  thread?: ThreadSummary | null;
}
