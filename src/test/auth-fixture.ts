import type { AuthSession } from "@/lib/auth-client";
import type { AuthContextValue } from "@/features/auth/auth-context";

// Unit-test fixtures only; the application has no demo or mock authentication mode.
export const sessionFixture: AuthSession = {
  user: {
    id: "test-user",
    name: "Alex Morgan",
    email: "alex@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  session: {
    id: "test-session",
    userId: "test-user",
    token: "unit-test-only",
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600_000),
  },
};

export const signedOutState: AuthContextValue = {
  client: null,
  session: null,
  pending: false,
  error: false,
  configurationError: null,
  refresh: async () => {},
};
