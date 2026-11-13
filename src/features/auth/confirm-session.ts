import type { AuthClient, AuthSession } from "@/lib/auth-client";

export async function confirmSession(
  client: AuthClient,
): Promise<AuthSession | null> {
  const { data, error } = await client.getSession({
    query: { disableCookieCache: true },
  });
  if (error) {
    if (error.status === 401) return null;
    throw new Error(
      "The authentication service could not confirm the session.",
    );
  }
  return data;
}
