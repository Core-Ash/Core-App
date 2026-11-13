import { useState, type ReactNode } from "react";
import { ErrorScreen } from "@/components/common/ErrorScreen";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { useAuth } from "./auth-context";

export function SessionGate({ children }: { children: ReactNode }) {
  const { pending, error, refresh } = useAuth();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    try {
      await refresh();
    } catch {
      /* The error screen remains available for another attempt. */
    } finally {
      setRetrying(false);
    }
  }

  if (pending) return <LoadingScreen />;
  if (error) {
    return (
      <ErrorScreen
        title="We couldn't check your session"
        description="Check your connection and try again. If this continues, the authentication service may be temporarily unavailable."
        onRetry={() => {
          void retry();
        }}
        busy={retrying}
      />
    );
  }
  return children;
}
