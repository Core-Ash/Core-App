import type { PublicProfile } from "@/lib/api/types";

export type MentionKind = "user" | "role" | "everyone" | "here";
export interface Mention {
  kind: MentionKind;
  id?: string;
  start: number;
  end: number;
  label?: string;
  color?: string | null;
  profile?: PublicProfile;
}
export interface MentionSuggestion {
  kind: MentionKind;
  id?: string;
  label: string;
  detail?: string;
  color?: string | null;
  profile?: PublicProfile;
}
// Rendering and personal highlights must agree on which spans are actual mentions.
export function visibleMentions(body: string, mentions: Mention[] = []) {
  let end = 0;
  return mentions.filter((mention) => {
    if (!Number.isInteger(mention.start) || !Number.isInteger(mention.end) || mention.start < end || mention.start >= mention.end || mention.end > body.length || body[mention.start] !== "@") return false;
    if ((mention.kind === "user" || mention.kind === "role") && !mention.id) return false;
    end = mention.end;
    return true;
  });
}
export function messageMentionsCurrentUser(
  body: string,
  mentions: Mention[] | undefined,
  currentUserId?: string,
  currentUserRoleIds?: ReadonlySet<string> | readonly string[],
) {
  if (!currentUserId) return false;
  const roleSet =
    currentUserRoleIds instanceof Set
      ? currentUserRoleIds
      : currentUserRoleIds
        ? new Set(currentUserRoleIds)
        : null;
  return visibleMentions(body, mentions).some(
    (m) =>
      (m.kind === "user" && m.id === currentUserId) ||
      m.kind === "everyone" ||
      m.kind === "here" ||
      (m.kind === "role" && Boolean(m.id && roleSet?.has(m.id))),
  );
}
// Readable clipboard text: current mention labels, never internal IDs.
export function plainMessageText(body: string, mentions: Mention[] = []) {
  let position = 0;
  let text = "";
  for (const mention of visibleMentions(body, mentions)) {
    text += body.slice(position, mention.start) + (mention.label ? `@${mention.label}` : body.slice(mention.start, mention.end));
    position = mention.end;
  }
  return text + body.slice(position);
}
export function mentionQuery(body: string, start: number, end: number, mentions: Mention[]) {
  if (start !== end || mentions.some((m) => start > m.start && start <= m.end)) return null;
  const match = /(?:^|[\s([{])@([^\s@]{0,100})$/u.exec(body.slice(0, start));
  return match ? { start: start - match[1]!.length - 1, end: start, search: match[1]! } : null;
}
// Preserve spans outside the changed range; editing any part of a label turns it into ordinary text.
export function reconcileMentions(before: string, after: string, mentions: Mention[]): Mention[] {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
  const oldEnd = before.length - suffix;
  const delta = after.length - before.length;
  return mentions.flatMap((m) => m.end <= prefix ? [m] : m.start >= oldEnd ? [{ ...m, start: m.start + delta, end: m.end + delta }] : []);
}
export function mentionPayload(mentions: Mention[]) {
  return mentions.map(({ kind, id, start, end }) => ({ kind, ...(id ? { id } : {}), start, end }));
}
export function reconcileMentionEdit(before: string, after: string, mentions: Mention[], start: number, end: number) {
  const inserted = after.length - (before.length - (end - start));
  if (inserted < 0 || before.slice(0, start) !== after.slice(0, start) || before.slice(end) !== after.slice(start + inserted)) return reconcileMentions(before, after, mentions);
  const delta = inserted - (end - start);
  return mentions.flatMap((m) => m.end <= start ? [m] : m.start >= end ? [{ ...m, start: m.start + delta, end: m.end + delta }] : []);
}
