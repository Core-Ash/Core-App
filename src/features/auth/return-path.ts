export function getReturnPath(state: unknown): string {
  if (typeof state !== "object" || state === null || !("from" in state))
    return "/app";
  const from = state.from;
  // Only restore destinations in the authenticated app, never an external URL or login route.
  return typeof from === "string" &&
    /^\/app(?:[/?#]|$)/.test(from) &&
    !from.includes("\\")
    ? from
    : "/app";
}
