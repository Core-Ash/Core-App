import { ApiError } from "@/lib/api/errors";
import type {
  Channel,
  Community,
  Message,
  MessagePage,
  Profile,
} from "@/lib/api/types";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError("invalid_response");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new ApiError("invalid_response");
  return value;
}
function uuid(value: unknown): string {
  const text = string(value);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      text,
    )
  )
    throw new ApiError("invalid_response");
  return text;
}
function timestamp(value: unknown): string {
  const text = string(value);
  if (!Number.isFinite(Date.parse(text)))
    throw new ApiError("invalid_response");
  return text;
}
export function parseProfile(value: unknown): Profile {
  const data = record(value);
  return {
    id: uuid(data.id),
    username: string(data.username),
    email: string(data.email),
    display_name: string(data.display_name),
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
  return {
    id: uuid(data.id),
    author_id: uuid(data.author_id),
    body: data.body === null ? null : string(data.body),
    created_at: timestamp(data.created_at),
    edited_at: data.edited_at === null ? null : timestamp(data.edited_at),
    deleted_at: data.deleted_at === null ? null : timestamp(data.deleted_at),
    client_nonce: uuid(data.client_nonce),
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
