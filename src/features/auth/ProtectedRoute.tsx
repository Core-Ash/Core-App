import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./auth-context";
import { SessionGate } from "./SessionGate";

function ProtectedContent() {
  const { session } = useAuth();
  const location = useLocation();
  return session ? (
    <Outlet />
  ) : (
    <Navigate
      to="/login"
      replace
      state={{ from: location.pathname + location.search + location.hash }}
    />
  );
}

export function ProtectedRoute() {
  return (
    <SessionGate>
      <ProtectedContent />
    </SessionGate>
  );
}
