import { describe, expect, it } from "vitest";
import { displayName, publicUsername } from "@/lib/display-name";
import { profileFixture } from "@/test/api-fixtures";

describe("public identity labels", () => {
  it("prefers a display name and then a public username", () => {
    expect(displayName(profileFixture)).toBe(profileFixture.display_name);
    expect(displayName({ ...profileFixture, display_name: " " })).toBe(profileFixture.username);
  });
  it.each(["u_e8d4720993964d8e9559cc1a054bb8", "u_111111111111411181111111111111", profileFixture.id])(
    "does not substitute internal identity %s for a public label", (value) => {
      const profile = { ...profileFixture, display_name: value, username: value };
      expect(displayName(profile)).toBe("Unknown User");
      expect(publicUsername(profile)).toBe("");
    });
  it("handles missing profiles and auth identifiers", () => {
    expect(displayName(null)).toBe("Unknown User");
    expect(displayName({ id: "auth-user-id", display_name: "", username: "auth-user-id" })).toBe("Unknown User");
  });
});
