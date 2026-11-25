import { ApiError } from "@/lib/api/errors";

export type PermissionTarget = { kind: "role" | "member"; id: string };
export type PermissionEntry = PermissionTarget & { permission: string; state: boolean | null };
export interface PermissionSnapshot {
  version: string;
  resource: { name: string; kind?: string; category_id?: string | null; category_name?: string; sync_with_category?: boolean; is_private?: boolean };
  entries: PermissionEntry[];
  roles: { id: string; name: string; color: string | null; is_default: boolean; manageable: boolean }[];
  members: { id: string; name: string; username: string; avatar_url: string | null; manageable: boolean }[];
  grantable: string[];
  children?: { id: string; name: string; synced: boolean }[];
}
export const targetKey = (target: PermissionTarget) => `${target.kind}:${target.id}`;
export const entryKey = (entry: PermissionEntry) => `${targetKey(entry)}:${entry.permission}`;
export const sameTarget = (a: PermissionTarget, b: PermissionTarget) => targetKey(a) === targetKey(b);
export function permissionChanges(before: PermissionEntry[], after: PermissionEntry[]) {
  const old = new Map(before.map(e => [entryKey(e), e]));
  const next = new Map(after.map(e => [entryKey(e), e]));
  return [...new Set([...old.keys(), ...next.keys()])].flatMap(key => {
    const state = next.get(key)?.state ?? null;
    const entry = next.get(key) ?? old.get(key)!;
    return (old.get(key)?.state ?? null) === state ? [] : [{ ...entry, state }];
  });
}
export function snapshotTargets(snapshot: PermissionSnapshot): PermissionTarget[] {
  const everyone = snapshot.roles.find(r => r.is_default);
  const targets = new Map<string, PermissionTarget>();
  if (everyone) targets.set(`role:${everyone.id}`, { kind: "role", id: everyone.id });
  for (const { kind, id } of snapshot.entries) targets.set(`${kind}:${id}`, { kind, id });
  return [...targets.values()];
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("invalid_response");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new ApiError("invalid_response");
  return value;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new ApiError("invalid_response");
  return value;
}
export function parsePermissionSnapshot(value: unknown): PermissionSnapshot {
  const data = object(value);
  const resource = object(data.resource);
  const entries = list(data.entries).map(value => {
    const e = object(value);
    if (!["role", "member"].includes(text(e.kind)) || (e.state !== null && typeof e.state !== "boolean")) throw new ApiError("invalid_response");
    return { kind: e.kind as PermissionTarget["kind"], id: text(e.id), permission: text(e.permission), state: e.state as boolean | null };
  });
  if (new Set(entries.map(entryKey)).size !== entries.length) throw new ApiError("invalid_response");
  return {
    version: text(data.version), resource: { ...resource, name: text(resource.name), kind: resource.kind === undefined ? undefined : text(resource.kind) }, entries,
    roles: list(data.roles).map(value => { const r = object(value); return { id: text(r.id), name: text(r.name), color: typeof r.color === "string" && /^#[\da-f]{6}$/i.test(r.color) ? r.color : null, is_default: r.is_default === true, manageable: r.manageable === true }; }),
    members: list(data.members).map(value => { const m = object(value); return { id: text(m.id), name: text(m.name), username: text(m.username), avatar_url: typeof m.avatar_url === "string" && m.avatar_url.startsWith("https://") ? m.avatar_url : null, manageable: m.manageable === true }; }),
    grantable: list(data.grantable).map(text),
    children: data.children === undefined ? undefined : list(data.children).map(value => { const c = object(value); return { id: text(c.id), name: text(c.name), synced: c.synced === true }; }),
  };
}
