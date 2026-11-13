import { Info } from "lucide-react";

export function AuthConfigurationNotice({
  message,
}: {
  message: string | null;
}) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="flex gap-2.5 rounded-lg border border-border bg-accent/50 p-3 text-xs leading-relaxed text-muted-foreground"
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
