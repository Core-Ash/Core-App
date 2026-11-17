export function getReturnPath(state: unknown): string {
  if (typeof state !== "object" || state === null || !("from" in state))
    return "/app";
  const from = state.from;
  // Accept source-owned local routes only, including the public invitation flow.
  return typeof from === "string" &&
    (/^\/app(?:[/?#]|$)/.test(from) || /^\/invite\/[a-f0-9]{64}$/.test(from)) &&
    !from.includes("\\") && !Array.from(from).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    ? from
    : "/app";
}
