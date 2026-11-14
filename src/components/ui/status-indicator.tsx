import { cn } from "@/lib/utils";

export type PresenceStatus = "online" | "playing" | "offline";

export function StatusIndicator({
  status,
  label,
  className,
}: {
  status: PresenceStatus;
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label ?? status}
      className={cn("status-indicator", `status-${status}`, className)}
    />
  );
}
