// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseMemberPage, parseMessage, parsePublicProfile } from "@/lib/api/contracts";
import { memberPageFixture, messageFixture, profileFixture } from "@/test/api-fixtures";

describe("public member profile contracts", () => {
  it("accepts public avatar URLs and nullable missing authors without exposing private fields", () => {
    expect(parsePublicProfile({ ...profileFixture, avatar_url: "https://cdn.example.com/member.png" })).toEqual({
      id: profileFixture.id, username: profileFixture.username, display_name: profileFixture.display_name,
      avatar_url: "https://cdn.example.com/member.png", discriminator: null,
    });
    expect(parseMessage({ ...messageFixture, author: null }).author).toBeNull();
  });
  it("rejects unsafe avatars, inconsistent authors, and malformed membership metadata", () => {
    for (const avatar_url of ["javascript:alert(1)", "http://example.com/a.png", "https://user:pass@example.com/a.png"])
      expect(() => parsePublicProfile({ ...profileFixture, avatar_url })).toThrow();
    expect(() => parseMessage({ ...messageFixture, author: { ...profileFixture, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } })).toThrow();
    for (const item of [{ ...memberPageFixture.items[0], joined_at: "bad" }, { ...memberPageFixture.items[0], roles: null }])
      expect(() => parseMemberPage({ ...memberPageFixture, items: [item] })).toThrow();
  });
});
