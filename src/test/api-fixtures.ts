import type { Channel, ChannelAccessPage, Community, MemberPage, Message, Profile } from "@/lib/api/types";

export const profileFixture: Profile = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "core_member",
  display_name: "Core Member",
  email: "member@example.com",
  avatar_url: null,
};
export const communityFixture: Community = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Test Squad",
  owner_id: profileFixture.id,
};
export const channelFixture: Channel = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "general",
  topic: "",
  position: 0,
};
export const messageFixture: Message = {
  id: "44444444-4444-4444-8444-444444444444",
  author_id: profileFixture.id,
  body: "A message from Rust",
  created_at: "2026-11-15T10:00:00+00:00",
  edited_at: null,
  deleted_at: null,
  client_nonce: "55555555-5555-4555-8555-555555555555",
  author: { id: profileFixture.id, display_name: profileFixture.display_name, username: profileFixture.username, avatar_url: null },
};

export const accessRoleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const memberPageFixture: MemberPage = {
  community_id: communityFixture.id, channel_id: channelFixture.id, total: 1, next_cursor: null,
  items: [{ id: profileFixture.id, display_name: profileFixture.display_name, username: profileFixture.username, avatar_url: null,
    community_id: communityFixture.id, joined_at: "2026-11-16T10:00:00Z",
    roles: [{ id: accessRoleId, name: "Member", color: "#E53945", position: 0 }] }],
};
export const channelAccessFixture: ChannelAccessPage = {
  channel: { id: channelFixture.id, community_id: communityFixture.id, name: channelFixture.name },
  total_allowed: 2, total_denied: 1, filtered_total: 2,
  roles: [{ id: accessRoleId, name: "Member", color: "#E53945", position: 0, member_count: 3, access: "inherited" }],
  items: [{ id: profileFixture.id, username: profileFixture.username, display_name: profileFixture.display_name,
    avatar_url: null, allowed: true, sources: [{ kind: "owner" }],
    highest_role: { id: accessRoleId, name: "Member", color: "#E53945" } }],
  next_cursor: null,
};
