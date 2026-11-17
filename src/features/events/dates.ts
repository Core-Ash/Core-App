export function localDateTime(iso: string): string {
  const date = new Date(iso), pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function utcDateTime(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const date = new Date(local);
  if (!Number.isFinite(date.getTime())) return null;
  const iso = date.toISOString();
  // Reject dates normalized by the browser, including nonexistent DST times.
  return localDateTime(iso) === local ? iso : null;
}
export function eventLocationHref(location: string): string | null {
  try { const url = new URL(location); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
