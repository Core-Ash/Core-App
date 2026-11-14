import { createAuthClient } from "better-auth/react";
import { authConfiguration } from "@/lib/env";

export type AuthClient = ReturnType<typeof createAuthClient>;
export type AuthSession = AuthClient["$Infer"]["Session"];
export type AuthUser = AuthSession["user"];

// A same-origin path must be explicitly configured; missing config never sends credentials.
export const authClient: AuthClient | null = authConfiguration.url
  ? createAuthClient({
      baseURL:
        authConfiguration.url === "/api/auth"
          ? new URL("/api/auth", window.location.origin).href
          : authConfiguration.url,
      fetchOptions: { credentials: "include", timeout: 15_000 },
      sessionOptions: {
        refetchInterval: 60,
        refetchOnWindowFocus: true,
        refetchWhenOffline: false,
      },
    })
  : null;
