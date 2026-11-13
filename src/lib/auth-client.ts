import { createAuthClient } from "better-auth/react";
import { authConfiguration } from "@/lib/env";

export type AuthClient = ReturnType<typeof createAuthClient>;
export type AuthSession = AuthClient["$Infer"]["Session"];
export type AuthUser = AuthSession["user"];

// No relative-URL fallback: an unconfigured app must never send credentials to itself.
export const authClient: AuthClient | null = authConfiguration.url
  ? createAuthClient({
      baseURL: authConfiguration.url,
      fetchOptions: { credentials: "include", timeout: 15_000 },
      sessionOptions: {
        refetchInterval: 60,
        refetchOnWindowFocus: true,
        refetchWhenOffline: false,
      },
    })
  : null;
