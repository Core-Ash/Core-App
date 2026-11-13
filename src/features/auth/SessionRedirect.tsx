import { Navigate } from "react-router";
import { useAuth } from "./auth-context";
import { SessionGate } from "./SessionGate";

export function SessionRedirect() {
  const { session } = useAuth();
  return (
    <SessionGate>
      <Navigate to={session ? "/app" : "/login"} replace />
    </SessionGate>
  );
}
