import { expect, it } from "vitest";
import { parsePermissionSnapshot, permissionChanges, type PermissionEntry } from "./permission-model";

it("serializes Neutral as removal and ignores row ordering", () => {
  const entries: PermissionEntry[] = [{ kind: "role", id: "one", permission: "channels.view", state: true }, { kind: "member", id: "two", permission: "messages.send", state: false }];
  expect(permissionChanges(entries, [...entries].reverse())).toEqual([]);
  expect(permissionChanges(entries, entries.slice(1))).toEqual([{ ...entries[0], state: null }]);
  expect(permissionChanges([], [{ ...entries[0]!, state: null }])).toEqual([]);
});
it("rejects ambiguous or malformed permission snapshots", () => {
  const entry = { kind: "role", id: "one", permission: "channels.view", state: false };
  const snapshot = { version: "v1", resource: { name: "general" }, roles: [], members: [], grantable: [], entries: [entry] };
  expect(() => parsePermissionSnapshot({ ...snapshot, entries: [entry, entry] })).toThrow();
  expect(() => parsePermissionSnapshot({ ...snapshot, entries: [{ ...entry, state: "false" }] })).toThrow();
  expect(() => parsePermissionSnapshot({ ...snapshot, grantable: undefined })).toThrow();
  expect(parsePermissionSnapshot(snapshot).entries[0]?.state).toBe(false);
});
