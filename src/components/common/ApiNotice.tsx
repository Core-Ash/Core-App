import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api/errors";

export function ApiNotice({
  error,
  loading,
  onRetry,
  compact = false,
}: {
  error?: unknown;
  loading?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  if (loading)
    return (
      <p
        role="status"
        className="flex items-center gap-2 p-4 text-sm text-muted-foreground"
      >
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        {loading}
      </p>
    );
  return (
    <div
      role="alert"
      className={
        compact
          ? "p-3 text-xs text-muted-foreground"
          : "p-6 text-sm text-muted-foreground"
      }
    >
      <p>{apiErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
