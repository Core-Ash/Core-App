import type { AuthUser } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UserAvatar({
  user,
  className,
}: {
  user: AuthUser;
  className?: string;
}) {
  const initials = (user.name.trim() || user.email)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toLocaleUpperCase();
  return (
    <Avatar className={className}>
      {user.image && (
        <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback aria-label={user.name || user.email}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
