import { useLayoutEffect, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppDataContext } from "@/app/app-data-context";
import { useAuth } from "@/features/auth/auth-context";
import { confirmSession } from "@/features/auth/confirm-session";
import { apiConfiguration } from "@/lib/env";
import { SessionScope } from "@/lib/api/session-scope";

function DataScope({ children }: { children: ReactNode }) {
  const { client, session, pending, error, refresh } = useAuth();
  const [cleared, setCleared] = useState(false);
  const active = Boolean(session && !pending && !error);
  const [scope] = useState(
    () =>
      new SessionScope(
        apiConfiguration.url,
        async () => {
          if (!client) return "expired";
          try {
            const confirmed = await confirmSession(client);
            if (
              !confirmed ||
              confirmed.user.id !== session?.user.id ||
              confirmed.session.id !== session?.session.id
            )
              await refresh();
            return confirmed ? "active" : "expired";
          } catch {
            return "unavailable";
          }
        },
        Boolean(session && !pending && !error),
      ),
  );

  // Layout cleanup cancels queries AND mutations before a different identity can render.
  // React StrictMode can activate a fresh controller during its effect replay.
  useLayoutEffect(() => {
    scope.activate(active);
    return () => scope.clear();
  }, [scope, active]);

  return (
    <QueryClientProvider client={scope.queries}>
      <AppDataContext.Provider
        value={{
          api: scope.api,
          ready: Boolean(
            session && !pending && !error && apiConfiguration.url && !cleared,
          ),
          configured: apiConfiguration.configured,
          configurationError: apiConfiguration.error,
          clearPrivateData: () => {
            scope.clear();
            setCleared(true);
          },
        }}
      >
        {children}
      </AppDataContext.Provider>
    </QueryClientProvider>
  );
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { session, pending, error } = useAuth();
  const key =
    session && !pending && !error
      ? JSON.stringify([session.user.id, session.session.id])
      : "inactive";
  return <DataScope key={key}>{children}</DataScope>;
}
