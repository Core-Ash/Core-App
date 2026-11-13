import { createContext, useContext } from "react";
import type { AuthClient, AuthSession } from "@/lib/auth-client";

export interface AuthContextValue {
  client: AuthClient | null;
  session: AuthSession | null;
  pending: boolean;
  error: boolean;
  configurationError: string | null;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
