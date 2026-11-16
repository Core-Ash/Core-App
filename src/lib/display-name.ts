import type { PublicProfile } from "@/lib/api/types";

// Older profiles have generated usernames derived from internal identifiers.
export function publicIdentityLabel(value: string | null | undefined, id?: string): string {
  const label = value?.trim() ?? "";
  if (!label || label === id || /^u_[0-9a-f]{28,32}$/i.test(label) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(label)) return "";
  return label;
}

export function publicUsername(profile: Pick<PublicProfile, "id" | "username">): string {
  return publicIdentityLabel(profile.username, profile.id);
}

export function displayName(profile?: Pick<PublicProfile, "id" | "display_name" | "username"> | null): string {
  return profile
    ? publicIdentityLabel(profile.display_name, profile.id) || publicUsername(profile) || "Unknown User"
    : "Unknown User";
}
