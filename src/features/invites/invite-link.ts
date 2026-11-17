import { validInviteCode } from "@/features/invites/api";

// Extract a code for our own preview route. Never navigate to the pasted origin.
export function inviteDestination(input: string): string | null {
  const value = input.trim();
  if (!value || value.length > 2048 || /[\\]/.test(value) || Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
  if (validInviteCode(value)) return `/invite/${value}`;
  const relative = /^\/invite\/([a-f0-9]{64})\/?$/.exec(value);
  if (relative) return `/invite/${relative[1]}`;
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !localHttp) || url.username || url.password || url.search || url.hash) return null;
    const match = /^\/invite\/([a-f0-9]{64})\/?$/.exec(url.pathname);
    return match ? `/invite/${match[1]}` : null;
  } catch { return null; }
}
