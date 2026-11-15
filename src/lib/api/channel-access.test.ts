// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "@/lib/api/client";
import { parseChannelAccess } from "@/lib/api/contracts";
import { endpoints } from "@/lib/api/endpoints";
import { channelAccessFixture, channelFixture, communityFixture } from "@/test/api-fixtures";

afterEach(() => vi.unstubAllGlobals());
describe("channel access boundary", () => {
  it("rejects malformed member data, permission sources, colors, counts, and cursors", () => {
    const corruptions = [
      { total_allowed: -1 }, { total_denied: "3" }, { filtered_total: null },
      { next_cursor: "not-uuid" }, { channel: { id: channelFixture.id } },
      { roles: [{ ...channelAccessFixture.roles[0], color: "url(https://untrusted.test)" }] },
      { items: [{ ...channelAccessFixture.items[0], sources: [{ kind: "administrator" }] }] },
      { items: [{ ...channelAccessFixture.items[0], sources: [{ kind: "role_allow" }] }] },
      { items: [{ ...channelAccessFixture.items[0], sources: [] }] },
      { items: [{ ...channelAccessFixture.items[0], allowed: "true" }] },
      { items: [{ ...channelAccessFixture.items[0], avatar_url: "javascript:alert(1)" }] },
    ];
    for (const corruption of corruptions)
      expect(() => parseChannelAccess({ ...channelAccessFixture, ...corruption })).toThrow();
  });
  it("rejects a response for a different channel or community", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ ...channelAccessFixture, channel: {
      ...channelAccessFixture.channel, community_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    } }));
    vi.stubGlobal("fetch", request);
    const api = createApiClient({ baseUrl: "/api/v1", sessionSignal: () => new AbortController().signal,
      onUnauthorized: async () => "expired" });
    await expect(endpoints.channelAccess(api, communityFixture.id, channelFixture.id,
      { search: "", access: "allowed", roleId: "" }, null)).rejects.toMatchObject({ kind: "invalid_response" });
  });
});
