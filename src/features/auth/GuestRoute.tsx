import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./auth-context";
import { getReturnPath } from "./return-path";
import { SessionGate } from "./SessionGate";

function GuestContent() {
  const { session } = useAuth();
  const location = useLocation();
  return session ? (
    <Navigate to={getReturnPath(location.state)} replace />
  ) : (
    <Outlet />
  );
}

export function GuestRoute() {
  return (
    <SessionGate>
      <GuestContent />
    </SessionGate>
  );
}
