import { ApiError } from "@/lib/api/errors";
import type {
  Channel,
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
  };
}
export function parseMessage(value: unknown): Message {
  const data = record(value);
  const author = data.author === null ? null : parsePublicProfile(data.author);
  if (author && author.id !== data.author_id) throw new ApiError("invalid_response");
  return {
    id: uuid(data.id),
    author_id: uuid(data.author_id),
    body: data.body === null ? null : string(data.body),
    created_at: timestamp(data.created_at),
    edited_at: data.edited_at === null ? null : timestamp(data.edited_at),
    deleted_at: data.deleted_at === null ? null : timestamp(data.deleted_at),
    client_nonce: uuid(data.client_nonce),
    author,
  };
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
  if (!["owner", "member_allow", "member_deny", "role_allow", "role_deny", "inherited", "no_grant"].includes(kind))
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
    roles: data.roles.map((value) => {
      const role = record(value);
      return { id: uuid(role.id), name: string(role.name), color: color(role.color), position: count(role.position) };
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

export function parseConversationDetail(value: unknown): ConversationDetail {
  const data = record(value);
  const type = string(data.type);
  if (type !== "direct" && type !== "group") throw new ApiError("invalid_response");
  const role = string(data.role);
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

