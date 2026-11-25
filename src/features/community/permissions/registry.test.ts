import { describe, expect, it } from "vitest";
import { PERMISSIONS, channelPermissions, matchesPermission, permissionAvailability } from "./registry";

describe("shared permission catalog", () => {
  it("preserves every existing wire key with unique definitions and Discord equivalents", () => {
    expect(new Set(PERMISSIONS.map(p => p.key)).size).toBe(PERMISSIONS.length);
    expect(new Set(PERMISSIONS.map(p => p.flag)).size).toBe(PERMISSIONS.length);
    for (const key of ["administrator", "community.manage", "members.manage", "roles.manage", "channels.manage", "channels.view", "messages.send", "messages.moderate", "audit.view", "bans.manage", "emojis.manage", "invites.create", "invites.manage", "events.create", "events.manage"]) {
      expect(PERMISSIONS.some(p => p.key === key)).toBe(true);
    }
  });
  it("limits overrides to applicable resources and keeps server-only privileges out", () => {
    expect(channelPermissions("voice").some(p => p.key === "voice.connect")).toBe(true);
    expect(channelPermissions("text").some(p => p.key === "voice.connect")).toBe(false);
    expect(channelPermissions("category").some(p => p.key === "messages.send")).toBe(true);
    for (const kind of ["text", "voice", "category"]) expect(channelPermissions(kind).some(p => p.key === "administrator")).toBe(false);
  });
  it("searches descriptions, groups, and documented flag names", () => {
    const send = PERMISSIONS.find(p => p.key === "messages.send")!;
    for (const query of [" SEND MESSAGES ", "text channel permissions", "SEND_MESSAGES", "text channels"]) expect(matchesPermission(send, query)).toBe(true);
    expect(matchesPermission(send, "soundboard")).toBe(false);
  });
  it("labels every incomplete feature and ends with Administrator", () => {
    for (const permission of PERMISSIONS) {
      expect(["enforced", "foundation", "unsupported"]).toContain(permission.status);
      expect(Boolean(permissionAvailability(permission))).toBe(permission.status !== "enforced");
      for (const dependency of permission.dependencies) expect(PERMISSIONS.some(p => p.key === dependency)).toBe(true);
    }
    expect(PERMISSIONS.at(-1)?.key).toBe("administrator");
  });
});
