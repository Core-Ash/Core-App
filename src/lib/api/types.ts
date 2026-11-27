import type { Mention } from "@/features/mentions/model";
export interface PublicProfile {
  id: string;
  username: string;
  discriminator?: string | null;
  display_name: string;
  avatar_url: string | null;
}
export interface Profile extends PublicProfile {
  email: string;
}
export interface MemberRole {
  id: string;
  name: string;
  color: string | null;
  position: number;
  hoist?: boolean;
}
export interface ServerMember extends PublicProfile {
  nickname?: string | null;
  timeout_until?: string | null;
  community_id: string;
  joined_at: string;
  roles: MemberRole[];
}
export interface MemberPage {
  community_id: string;
  channel_id: string | null;
  total: number;
  items: ServerMember[];
  next_cursor: string | null;
}
export interface Community {
  id: string;
  name: string;
  owner_id: string;
}
export interface ChannelCategory {
  id: string;
  name: string;
  position: number;
  is_private: boolean;
  is_collapsed: boolean;
  is_muted: boolean;
}
export interface Channel {
  id: string;
  name: string;
  topic: string;
  position: number;
  category_id?: string | null;
  kind?: "text" | "voice";
  is_muted?: boolean;
  can_send_messages?: boolean;
  can_add_reactions?: boolean;
  can_create_public_threads?: boolean;
  can_create_private_threads?: boolean;
  can_send_in_threads?: boolean;
  can_manage_threads?: boolean;
}
export interface MessageAttachment {
  id: string;
  name: string;
  content_type: string;
  size_bytes: number;
  url: string;
}
export interface MessageReactionGroup {
  emoji: string;
  emoji_name?: string | null;
  emoji_url?: string | null;
  count: number;
  me: boolean;
  users: PublicProfile[];
}
export interface ReactionUserEntry {
  user: PublicProfile;
  emoji: string;
  emoji_name?: string | null;
  emoji_url?: string | null;
  created_at: string;
}
export interface ReactionUsersPage {
  items: ReactionUserEntry[];
  next_cursor: string | null;
}
export interface MessageReplyReference {
  id: string;
  author_id: string | null;
  author: PublicProfile | null;
  body: string | null;
  deleted: boolean;
  has_attachments?: boolean;
}
export interface ForwardedMessageSnapshot {
  message_id?: string | null;
  author_id?: string | null;
  author: PublicProfile | null;
  body: string;
  created_at: string;
  forwarded_at?: string | null;
  attachments?: MessageAttachment[];
}
export interface ThreadSummary {
  id: string;
  parent_channel_id: string;
  starter_message_id: string | null;
  name: string;
  creator_id: string;
  thread_type: "public" | "private";
  created_at: string;
  last_activity_at: string;
  archived: boolean;
  locked: boolean;
  message_count: number;
  participants: PublicProfile[];
}
export interface ThreadDetail extends ThreadSummary {
  community_id: string;
  starter_message?: Message | null;
  is_joined: boolean;
  can_manage: boolean;
  can_lock: boolean;
  can_delete: boolean;
  can_send: boolean;
}
export interface Message {
  mentions?: Mention[];
  id: string;
  author_id: string;
  body: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  client_nonce: string;
  author: PublicProfile | null;
  attachments?: MessageAttachment[];
  reactions?: MessageReactionGroup[];
  reply_to_message_id?: string | null;
  reply_mention?: boolean;
  reply_to?: MessageReplyReference | null;
  forwarded?: ForwardedMessageSnapshot | null;
  thread_id?: string | null;
  thread?: ThreadSummary | null;
}
export interface MessageCursor {
  before_time: string;
  before_id: string;
}
export interface MessagePage {
  items: Message[];
  next_cursor: MessageCursor | null;
}

export type AccessSourceKind = "owner" | "administrator" | "member_allow" | "member_deny" | "role_allow" | "role_deny" | "inherited" | "no_grant";
export interface AccessSource {
  kind: AccessSourceKind;
  role_id?: string;
  role_name?: string;
}
export interface AccessRole {
  id: string;
  name: string;
  color: string | null;
  position: number;
  member_count: number;
  access: "allowed" | "denied" | "inherited" | "none";
}
export interface AccessMember extends PublicProfile {
  allowed: boolean;
  sources: AccessSource[];
  highest_role: Pick<AccessRole, "id" | "name" | "color"> | null;
}
export interface ChannelAccessPage {
  channel: { id: string; community_id: string; name: string };
  total_allowed: number;
  total_denied: number;
  filtered_total: number;
  roles: AccessRole[];
  items: AccessMember[];
  next_cursor: string | null;
}
export interface ChannelAccessFilters {
  search: string;
  roleId: string;
  access: "allowed" | "denied";
}

export type ConversationType = "direct" | "group";

export interface ConversationParticipant {
  id: string;
  role: "owner" | "member";
  joined_at: string;
  profile: PublicProfile;
}

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  name: string | null;
  icon_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  role: "owner" | "member";
  hidden: boolean;
  members: ConversationParticipant[];
  last_message?: {
    id: string;
    author_id: string;
    body: string | null;
    created_at: string;
    client_nonce: string;
  } | null;
}

export interface ConversationDetail {
  id: string;
  type: ConversationType;
  name: string | null;
  icon_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  role: "owner" | "member";
  members: ConversationParticipant[];
}

