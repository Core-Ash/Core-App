export function getDevAuthProxyTarget(
  value: string | undefined,
): string | undefined {
  if (!value?.trim()) return undefined;

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    ) {
      throw new Error("Invalid proxy origin");
    }
    return url.origin;
  } catch {
    // Never include a supplied URL in errors: it could contain credentials.
    throw new Error(
      "DEV_AUTH_PROXY_TARGET must be an HTTPS origin without credentials, a path, a query, or a fragment.",
    );
  }
}

export function getDevAuthProxyHttps(value: string | undefined): boolean {
  if (!value?.trim() || value.trim() === "true") return true;
  if (value.trim() === "false") return false;
  throw new Error("DEV_AUTH_PROXY_HTTPS must be true or false.");
}
