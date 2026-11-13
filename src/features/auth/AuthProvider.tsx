import { useState, type ReactNode } from "react";
import { authClient, type AuthClient } from "@/lib/auth-client";
import { authConfiguration } from "@/lib/env";
import { AuthContext } from "./auth-context";

function ConfiguredAuthProvider({
  client,
  children,
}: {
  client: AuthClient;
  children: ReactNode;
}) {
  const { data, isPending, error, refetch } = client.useSession();
  const [initializing, setInitializing] = useState(true);
  // Later cookie rechecks must not unmount and reset a guest's in-progress form.
  if (initializing && !isPending) setInitializing(false);

  return (
    <AuthContext.Provider
      value={{
        client,
        session: data,
        pending: initializing && isPending,
        error: Boolean(error && error.status !== 401),
        configurationError: null,
        refresh: async () => {
          await refetch();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (authClient) {
    return (
      <ConfiguredAuthProvider client={authClient}>
        {children}
      </ConfiguredAuthProvider>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        client: null,
        session: null,
        pending: false,
        error: false,
        configurationError: authConfiguration.error,
        refresh: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
