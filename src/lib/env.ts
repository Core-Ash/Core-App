type AuthConfiguration =
  | { url: string; error: null }
  | { url: null; error: string };

export function parseAuthUrl(value: string | undefined): AuthConfiguration {
  if (!value?.trim()) {
    return {
      url: null,
      error:
        "Authentication is not configured yet. Set VITE_AUTH_URL in your .env.local file and restart the development server.",
    };
  }

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.replace(/\.$/, "");
    if (
      hostname === "railway.internal" ||
      hostname.endsWith(".railway.internal")
    ) {
      return {
        url: null,
        error:
          "VITE_AUTH_URL must use Core-auth's public HTTPS URL. Railway internal hostnames cannot be used in the browser.",
      };
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error("Invalid auth URL");
    }
    if (
      url.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ) {
      throw new Error("HTTPS is required outside localhost");
    }
    return { url: url.toString().replace(/\/+$/, ""), error: null };
  } catch {
    return {
      url: null,
      error:
        "VITE_AUTH_URL must be an HTTPS service URL (HTTP is allowed for localhost), without credentials, a query, or a fragment.",
    };
  }
}

export const authConfiguration = parseAuthUrl(import.meta.env.VITE_AUTH_URL);
