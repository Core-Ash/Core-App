import type { Channel, Community, Message, Profile } from "@/lib/api/types";

export const profileFixture: Profile = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "core_member",
  display_name: "Core Member",
  email: "member@example.com",
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
};
