export interface PublicProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}
export interface Profile extends PublicProfile {
  email: string;
}
export interface MemberRole {
  id: string;
  name: string;
  color: string | null;
  position: number;
}
export interface ServerMember extends PublicProfile {
  community_id: string;
  joined_at: string;
  roles: MemberRole[];
}
export interface MemberPage {
  community_id: string;
  channel_id: string | null;
  total: number;
  items: ServerMember[];
  next_cursor: string | null;
}
export interface Community {
  id: string;
  name: string;
  owner_id: string;
}
export interface Channel {
  id: string;
  name: string;
  topic: string;
  position: number;
}
export interface Message {
  id: string;
  author_id: string;
  body: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  client_nonce: string;
  author: PublicProfile | null;
}
export interface MessageCursor {
  before_time: string;
  before_id: string;
}
export interface MessagePage {
  items: Message[];
  next_cursor: MessageCursor | null;
}

export type AccessSourceKind = "owner" | "member_allow" | "member_deny" | "role_allow" | "role_deny" | "inherited" | "no_grant";
export interface AccessSource {
  kind: AccessSourceKind;
  role_id?: string;
  role_name?: string;
}
export interface AccessRole {
  id: string;
  name: string;
  color: string | null;
  position: number;
  member_count: number;
  access: "allowed" | "denied" | "inherited" | "none";
}
export interface AccessMember extends PublicProfile {
  allowed: boolean;
  sources: AccessSource[];
  highest_role: Pick<AccessRole, "id" | "name" | "color"> | null;
}
export interface ChannelAccessPage {
  channel: { id: string; community_id: string; name: string };
  total_allowed: number;
  total_denied: number;
  filtered_total: number;
  roles: AccessRole[];
  items: AccessMember[];
  next_cursor: string | null;
}
export interface ChannelAccessFilters {
  search: string;
  roleId: string;
  access: "allowed" | "denied";
}
