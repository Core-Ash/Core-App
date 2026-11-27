import { ApiError } from "@/lib/api/errors";
import type { Mention, MentionKind } from "@/features/mentions/model";
import type {
  Channel,
  ChannelCategory,
  Community,
  Message,
  MessagePage,
  Profile,
  AccessMember,
  AccessRole,
  AccessSource,
  ChannelAccessPage,
  PublicProfile,
  MemberPage,
  ServerMember,
  ConversationDetail,
  ConversationParticipant,
  ConversationSummary,
  ConversationType,
  ForwardedMessageSnapshot,
  MessageAttachment,
  MessageReactionGroup,
  MessageReplyReference,
  ReactionUserEntry,
  ReactionUsersPage,
  ThreadDetail,
  ThreadSummary,
} from "@/lib/api/types";

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError("invalid_response");
  return value as Record<string, unknown>;
}
export function string(value: unknown): string {
  if (typeof value !== "string") throw new ApiError("invalid_response");
  return value;
}
export function uuid(value: unknown): string {
  const text = string(value);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      text,
    )
  )
    throw new ApiError("invalid_response");
  return text;
}
export function timestamp(value: unknown): string {
  const text = string(value);
  if (!Number.isFinite(Date.parse(text)))
    throw new ApiError("invalid_response");
  return text;
}
export function parseProfile(value: unknown): Profile {
  const data = record(value);
  return {
    ...parsePublicProfile(value),
    email: string(data.email),
  };
}
function avatarUrl(value: unknown): string | null {
  if (value === null) return null;
  const text = string(value);
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new ApiError("invalid_response"); }
}
export function parsePublicProfile(value: unknown): PublicProfile {
  const data = record(value);
  const discriminator = data.discriminator == null ? null : string(data.discriminator);
  if (discriminator !== null && !/^[0-9]{4}$/.test(discriminator)) throw new ApiError("invalid_response");
  return { id: uuid(data.id), username: string(data.username), discriminator, display_name: string(data.display_name), avatar_url: avatarUrl(data.avatar_url) };
}
export function parseBootstrap(value: unknown) {
  const data = record(value);
  return {
    profile: parseProfile(data.profile),
    communities: parseList(data.communities, parseCommunity),
  };
}
export function parseCommunity(value: unknown): Community {
  const data = record(value);
  return {
    id: uuid(data.id),
    name: string(data.name),
    owner_id: uuid(data.owner_id),
  };
}
export function parseChannelCategory(value: unknown): ChannelCategory {
  const data = record(value);
  if (
    typeof data.position !== "number" ||
    !Number.isInteger(data.position) ||
    data.position < 0
  )
    throw new ApiError("invalid_response");
  return {
    id: uuid(data.id),
    name: string(data.name),
    position: data.position,
    is_private: Boolean(data.is_private),
    is_collapsed: Boolean(data.is_collapsed),
    is_muted: Boolean(data.is_muted),
  };
}

export function parseChannel(value: unknown): Channel {
  const data = record(value);
  if (
    typeof data.position !== "number" ||
    !Number.isInteger(data.position) ||
    data.position < 0
  )
    throw new ApiError("invalid_response");
  return {
    id: uuid(data.id),
    name: string(data.name),
    topic: string(data.topic),
    position: data.position,
    category_id: data.category_id ? uuid(data.category_id) : null,
    kind: data.kind === "voice" ? "voice" : "text",
    is_muted: Boolean(data.is_muted),
    can_send_messages: typeof data.can_send_messages === "boolean" ? data.can_send_messages : true,
    can_add_reactions: typeof data.can_add_reactions === "boolean" ? data.can_add_reactions : true,
    can_create_public_threads: typeof data.can_create_public_threads === "boolean" ? data.can_create_public_threads : true,
    can_create_private_threads: typeof data.can_create_private_threads === "boolean" ? data.can_create_private_threads : true,
    can_send_in_threads: typeof data.can_send_in_threads === "boolean" ? data.can_send_in_threads : true,
    can_manage_threads: typeof data.can_manage_threads === "boolean" ? data.can_manage_threads : false,
  };
}
export function parseMessageAttachment(value: unknown): MessageAttachment {
  const data = record(value);
  return {
    id: uuid(data.id),
    name: string(data.name),
    content_type: string(data.content_type),
    size_bytes: count(data.size_bytes),
    url: avatarUrl(data.url)!,
  };
}
export function parseMessageReactionGroup(value: unknown): MessageReactionGroup {
  const data = record(value);
  return {
    emoji: string(data.emoji),
    emoji_name: data.emoji_name == null ? null : string(data.emoji_name),
    emoji_url: data.emoji_url == null ? null : avatarUrl(data.emoji_url),
    count: count(data.count),
    me: Boolean(data.me),
    users: Array.isArray(data.users) ? data.users.map(parsePublicProfile) : [],
  };
}
export function parseReactionUserEntry(value: unknown): ReactionUserEntry {
  const data = record(value);
  return {
    user: parsePublicProfile(data.user),
    emoji: string(data.emoji),
    emoji_name: data.emoji_name == null ? null : string(data.emoji_name),
    emoji_url: data.emoji_url == null ? null : avatarUrl(data.emoji_url),
    created_at: timestamp(data.created_at),
  };
}
export function parseReactionUsersPage(value: unknown): ReactionUsersPage {
  const data = record(value);
  return {
    items: parseList(value, parseReactionUserEntry),
    next_cursor: data.next_cursor == null ? null : uuid(data.next_cursor),
  };
}
export function parseMessageReplyReference(value: unknown): MessageReplyReference {
  const data = record(value);
  return {
    id: uuid(data.id),
    author_id: data.author_id == null ? null : uuid(data.author_id),
    author: data.author == null ? null : parsePublicProfile(data.author),
    body: data.body == null ? null : string(data.body),
    deleted: Boolean(data.deleted),
    has_attachments: Boolean(data.has_attachments),
  };
}
export function parseForwardedMessageSnapshot(value: unknown): ForwardedMessageSnapshot {
  const data = record(value);
  return {
    message_id: data.message_id == null ? null : uuid(data.message_id),
    author_id: data.author_id == null ? null : uuid(data.author_id),
    author: data.author == null ? null : parsePublicProfile(data.author),
    body: data.body == null ? "" : string(data.body),
    created_at: timestamp(data.created_at),
    forwarded_at: data.forwarded_at == null ? null : timestamp(data.forwarded_at),
    attachments: Array.isArray(data.attachments) ? data.attachments.map(parseMessageAttachment) : [],
  };
}
export function parseThreadSummary(value: unknown): ThreadSummary {
  const data = record(value);
  const threadType = string(data.thread_type);
  if (threadType !== "public" && threadType !== "private") throw new ApiError("invalid_response");
  return {
    id: uuid(data.id),
    parent_channel_id: uuid(data.parent_channel_id),
    starter_message_id: data.starter_message_id == null ? null : uuid(data.starter_message_id),
    name: string(data.name),
    creator_id: uuid(data.creator_id),
    thread_type: threadType,
    created_at: timestamp(data.created_at),
    last_activity_at: timestamp(data.last_activity_at),
    archived: Boolean(data.archived),
    locked: Boolean(data.locked),
    message_count: count(data.message_count),
    participants: Array.isArray(data.participants) ? data.participants.map(parsePublicProfile) : [],
  };
}
export function parseThreadDetail(value: unknown): ThreadDetail {
  const data = record(value);
  const summary = parseThreadSummary(value);
  return {
    ...summary,
    community_id: uuid(data.community_id),
    starter_message: data.starter_message == null ? null : parseMessage(data.starter_message),
    is_joined: Boolean(data.is_joined),
    can_manage: Boolean(data.can_manage),
    can_lock: Boolean(data.can_lock),
    can_delete: Boolean(data.can_delete),
    can_send: data.can_send === undefined ? true : Boolean(data.can_send),
  };
}
export function parseMessage(value: unknown): Message {
  const data = record(value);
  const author = data.author === null ? null : parsePublicProfile(data.author);
  if (author && author.id !== data.author_id) throw new ApiError("invalid_response");
  const body = data.body === null ? null : string(data.body);
  return {
    id: uuid(data.id),
    author_id: uuid(data.author_id),
    body,
    created_at: timestamp(data.created_at),
    edited_at: data.edited_at === null ? null : timestamp(data.edited_at),
    deleted_at: data.deleted_at === null ? null : timestamp(data.deleted_at),
    client_nonce: uuid(data.client_nonce),
    author,
    ...(data.mentions === undefined ? {} : { mentions: parseMentions(data.mentions, body ?? "") }),
    ...(Array.isArray(data.attachments) ? { attachments: data.attachments.map(parseMessageAttachment) } : {}),
    ...(Array.isArray(data.reactions) ? { reactions: data.reactions.map(parseMessageReactionGroup) } : {}),
    ...(data.reply_to_message_id === undefined ? {} : { reply_to_message_id: data.reply_to_message_id === null ? null : uuid(data.reply_to_message_id) }),
    ...(typeof data.reply_mention === "boolean" ? { reply_mention: data.reply_mention } : {}),
    ...(data.reply_to === undefined ? {} : { reply_to: data.reply_to === null ? null : parseMessageReplyReference(data.reply_to) }),
    ...(data.forwarded === undefined ? {} : { forwarded: data.forwarded === null ? null : parseForwardedMessageSnapshot(data.forwarded) }),
    ...(data.thread_id === undefined ? {} : { thread_id: data.thread_id === null ? null : uuid(data.thread_id) }),
    ...(data.thread === undefined ? {} : { thread: data.thread === null ? null : parseThreadSummary(data.thread) }),
  };
}
export function parseMentions(value: unknown, body: string): Mention[] {
  if (!Array.isArray(value) || value.length > 100) throw new ApiError("invalid_response");
  let previous = 0;
  return value.map((raw) => {
    const m = record(raw);
    const kind = string(m.kind) as MentionKind;
    if (!["user", "role", "everyone", "here"].includes(kind) || !Number.isInteger(m.start) || !Number.isInteger(m.end)) throw new ApiError("invalid_response");
    const start = m.start as number, end = m.end as number;
    if (start < previous || end <= start || end > body.length || body[start] !== "@") throw new ApiError("invalid_response");
    previous = end;
    const profile = m.profile === undefined ? undefined : parsePublicProfile(m.profile);
    const id = kind === "user" || kind === "role" ? uuid(m.id) : undefined;
    if (profile && (kind !== "user" || profile.id !== id)) throw new ApiError("invalid_response");
    return { kind, ...(id ? { id } : {}), start, end, label: typeof m.label === "string" ? m.label : undefined, color: typeof m.color === "string" && /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : null, profile };
  });
}
export function parseList<T>(value: unknown, parse: (item: unknown) => T): T[] {
  const { items } = record(value);
  if (!Array.isArray(items) || items.length > 100)
    throw new ApiError("invalid_response");
  return items.map(parse);
}
export function parseMessagePage(value: unknown): MessagePage {
  const data = record(value);
  const cursor = data.next_cursor === null ? null : record(data.next_cursor);
  return {
    items: parseList(value, parseMessage),
    next_cursor: cursor
      ? {
          before_time: timestamp(cursor.before_time),
          before_id: uuid(cursor.before_id),
        }
      : null,
  };
}

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new ApiError("invalid_response");
  return value;
}
function color(value: unknown): string | null {
  if (value === null) return null;
  const result = string(value);
  if (!/^#[0-9a-f]{6}$/i.test(result)) throw new ApiError("invalid_response");
  return result;
}
function accessRole(value: unknown): AccessRole {
  const data = record(value);
  const access = string(data.access);
  if (!["allowed", "denied", "inherited", "none"].includes(access))
    throw new ApiError("invalid_response");
  return {
    id: uuid(data.id), name: string(data.name), color: color(data.color),
    position: count(data.position), member_count: count(data.member_count),
    access: access as AccessRole["access"],
  };
}
function accessSource(value: unknown): AccessSource {
  const data = record(value);
  const kind = string(data.kind);
  if (!["owner", "administrator", "member_allow", "member_deny", "role_allow", "role_deny", "inherited", "no_grant"].includes(kind))
    throw new ApiError("invalid_response");
  if (["role_allow", "role_deny", "inherited"].includes(kind))
    return { kind: kind as AccessSource["kind"], role_id: uuid(data.role_id), role_name: string(data.role_name) };
  return { kind: kind as AccessSource["kind"] };
}
function accessMember(value: unknown): AccessMember {
  const data = record(value);
  if (typeof data.allowed !== "boolean" || !Array.isArray(data.sources) || !data.sources.length)
    throw new ApiError("invalid_response");
  const highest = data.highest_role === null ? null : record(data.highest_role);
  return {
    ...parsePublicProfile(value), allowed: data.allowed, sources: data.sources.map(accessSource),
    highest_role: highest ? { id: uuid(highest.id), name: string(highest.name), color: color(highest.color) } : null,
  };
}
export function parseChannelAccess(value: unknown): ChannelAccessPage {
  const data = record(value);
  const channel = record(data.channel);
  if (!Array.isArray(data.roles) || !Array.isArray(data.items) || data.items.length > 100)
    throw new ApiError("invalid_response");
  return {
    channel: { id: uuid(channel.id), community_id: uuid(channel.community_id), name: string(channel.name) },
    total_allowed: count(data.total_allowed), total_denied: count(data.total_denied), filtered_total: count(data.filtered_total),
    roles: data.roles.map(accessRole), items: data.items.map(accessMember),
    next_cursor: data.next_cursor === null ? null : uuid(data.next_cursor),
  };
}
function parseMember(value: unknown): ServerMember {
  const data = record(value);
  if (!Array.isArray(data.roles)) throw new ApiError("invalid_response");
  return {
    ...parsePublicProfile(value), community_id: uuid(data.community_id), joined_at: timestamp(data.joined_at),
    nickname: data.nickname === undefined || data.nickname === null ? null : string(data.nickname),
    timeout_until: data.timeout_until === undefined || data.timeout_until === null ? null : timestamp(data.timeout_until),
    roles: data.roles.map((value) => {
      const role = record(value);
      return {
        id: uuid(role.id),
        name: string(role.name),
        color: color(role.color),
        position: count(role.position),
        hoist: typeof role.hoist === "boolean" ? role.hoist : false,
      };
    }),
  };
}
export function parseMemberPage(value: unknown): MemberPage {
  const data = record(value);
  return {
    community_id: uuid(data.community_id), channel_id: data.channel_id === null ? null : uuid(data.channel_id),
    total: count(data.total), items: parseList(value, parseMember), next_cursor: data.next_cursor === null ? null : uuid(data.next_cursor),
  };
}

export function parseConversationParticipant(value: unknown): ConversationParticipant {
  const data = record(value);
  const role = string(data.role);
  if (role !== "owner" && role !== "member") throw new ApiError("invalid_response");
  return {
    id: uuid(data.id),
    role,
    joined_at: timestamp(data.joined_at),
    profile: parsePublicProfile(data.profile),
  };
}

export function parseConversationSummary(value: unknown): ConversationSummary {
  const data = record(value);
  const type = string(data.type);
  if (type !== "direct" && type !== "group") throw new ApiError("invalid_response");
  const role = string(data.role);
  if (role !== "owner" && role !== "member") throw new ApiError("invalid_response");
  if (!Array.isArray(data.members)) throw new ApiError("invalid_response");

  let lastMessage: ConversationSummary["last_message"] = null;
  if (data.last_message && typeof data.last_message === "object") {
    const lm = record(data.last_message);
    lastMessage = {
      id: uuid(lm.id),
      author_id: uuid(lm.author_id),
      body: lm.body === null ? null : string(lm.body),
      created_at: timestamp(lm.created_at),
      client_nonce: uuid(lm.client_nonce),
    };
  }

  return {
    id: uuid(data.id),
    type: type as ConversationType,
    name: data.name == null ? null : string(data.name),
    icon_url: avatarUrl(data.icon_url),
    created_by: uuid(data.created_by),
    created_at: timestamp(data.created_at),
    updated_at: timestamp(data.updated_at),
    last_message_at: timestamp(data.last_message_at),
    role: role as "owner" | "member",
    hidden: Boolean(data.hidden),
    members: data.members.map(parseConversationParticipant),
    last_message: lastMessage,
  };
}

export function parseConversationDetail(value: unknown, directOpen = false): ConversationDetail {
  const data = record(value);
  const type = string(data.type);
  if (type !== "direct" && type !== "group") throw new ApiError("invalid_response");
  // Rust's direct-open response omits role; both participants are members.
  // Keep GET/group contracts strict and never infer group ownership.
  const role = string(directOpen && type === "direct" && data.role === undefined ? "member" : data.role);
  if (role !== "owner" && role !== "member") throw new ApiError("invalid_response");
  if (!Array.isArray(data.members)) throw new ApiError("invalid_response");

  return {
    id: uuid(data.id),
    type: type as ConversationType,
    name: data.name == null ? null : string(data.name),
    icon_url: avatarUrl(data.icon_url),
    created_by: uuid(data.created_by),
    created_at: timestamp(data.created_at),
    updated_at: timestamp(data.updated_at),
    last_message_at: timestamp(data.last_message_at),
    role: role as "owner" | "member",
    members: data.members.map(parseConversationParticipant),
  };
}

