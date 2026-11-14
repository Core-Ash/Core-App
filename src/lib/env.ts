import { isPrivateHost } from "@/lib/public-host";

type AuthConfiguration =
  { url: string; error: null } | { url: null; error: string };

export function parseAuthUrl(
  value: string | undefined,
  production = false,
): AuthConfiguration {
  if (!value?.trim()) {
    return {
      url: null,
      error:
        "Authentication is not configured yet. Set VITE_AUTH_URL in your .env.local file and restart the development server.",
    };
  }

  if (value.trim() === "/api/auth") return { url: "/api/auth", error: null };

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
      (production ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    ) {
      throw new Error("HTTPS is required outside localhost");
    }
    if (production && isPrivateHost(hostname))
      throw new Error("A public service is required");
    return { url: url.toString().replace(/\/+$/, ""), error: null };
  } catch {
    return {
      url: null,
      error:
        "VITE_AUTH_URL must be an HTTPS service URL (HTTP is allowed for localhost), without credentials, a query, or a fragment.",
    };
  }
}

export function parseApiUrl(
  value: string | undefined,
  production = false,
): AuthConfiguration {
  if (value?.trim() === "/api/v1") return { url: "/api/v1", error: null };
  const configuration = parseAuthUrl(value, production);
  if (configuration.url && configuration.url !== "/api/auth") {
    const url = new URL(configuration.url);
    if (url.pathname === "/" || url.pathname === "/api/v1") {
      return { url: `${url.origin}/api/v1`, error: null };
    }
  }
  return {
    url: null,
    error:
      "Set VITE_API_URL to /api/v1 for the same-origin proxy, or a public HTTPS Rust origin (HTTP localhost is allowed in development). Do not include credentials, a query, or a fragment.",
  };
}

export const authConfiguration = parseAuthUrl(
  import.meta.env.VITE_AUTH_URL,
  import.meta.env.PROD,
);
export const apiConfiguration = {
  ...parseApiUrl(import.meta.env.VITE_API_URL, import.meta.env.PROD),
  configured: Boolean(import.meta.env.VITE_API_URL?.trim()),
};
