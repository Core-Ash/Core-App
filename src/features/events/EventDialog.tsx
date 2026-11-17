import { useId, useRef, useState, type ReactElement, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiNotice } from "@/components/common/ApiNotice";
import { useSaveEvent, type ServerEvent } from "@/features/events/api";
import { eventLocationHref, localDateTime, utcDateTime } from "@/features/events/dates";
import { communityHref } from "@/features/community/api/use-community-selection";
import type { Community } from "@/lib/api/types";

function EventForm({ community, existing, onSaved, onBusyChange }: { community: Community; existing?: ServerEvent; onSaved: () => void; onBusyChange: (busy: boolean) => void }) {
  const id = useId(), navigate = useNavigate(), save = useSaveEvent(community.id, existing);
  const busy = useRef(false), nonce = useRef<string | null>(null);
  const [values, setValues] = useState(() => {
    const start = existing ? localDateTime(existing.starts_at) : "", end = existing?.ends_at ? localDateTime(existing.ends_at) : "";
    return { name: existing?.name ?? "", description: existing?.description ?? "", location: existing?.location ?? "", startDate: start.split("T")[0] ?? "", startTime: start.split("T")[1] ?? "", endDate: end.split("T")[0] ?? "", endTime: end.split("T")[1] ?? "" };
  });
  const [error, setError] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  function update(key: keyof typeof values, value: string) { setValues((previous) => ({ ...previous, [key]: value })); nonce.current = null; setError(""); save.reset(); }
  return <form aria-label={existing ? "Edit server event" : "Create server event"} aria-busy={save.isPending} className="mt-5 space-y-4" onSubmit={(event) => {
    event.preventDefault(); if (busy.current) return;
    const starts = utcDateTime(`${values.startDate}T${values.startTime}`);
    const ends = values.endDate || values.endTime ? utcDateTime(`${values.endDate}T${values.endTime}`) : null;
    const location = values.location.trim(), name = values.name.trim();
    if (!name || Array.from(name).length > 100 || name.includes("\0") || !location || Array.from(location).length > 500 || location.includes("\0") || Array.from(values.description).length > 4000 || values.description.includes("\0")) { setError("Enter a name, location, and description within the displayed limits."); return; }
    if ((location.includes("://") || location.startsWith("//") || /^(javascript|data):/i.test(location)) && !eventLocationHref(location)) { setError("Enter a valid HTTP or HTTPS link, or a custom location."); return; }
    if (!starts || Date.parse(starts) <= Date.now()) { setError("Choose a valid future start date and time."); return; }
    if ((values.endDate || values.endTime) && (!ends || Date.parse(ends) <= Date.parse(starts))) { setError("Choose an end date and time after the start, or leave both empty."); return; }
    busy.current = true; onBusyChange(true); nonce.current ??= crypto.randomUUID(); setError("");
    void save.mutateAsync({ input: { name, description: values.description, location, starts_at: starts, ends_at: ends }, nonce: nonce.current })
      .then((saved) => { onSaved(); navigate(`${communityHref(community.id, undefined, "events")}&event=${saved.id}`, { state: { eventNotice: existing ? "Event updated" : "Event created" } }); })
      .catch(() => {}).finally(() => { busy.current = false; onBusyChange(false); });
  }}>
    <label className="block space-y-2 text-sm" htmlFor={`${id}-name`}>Event name (required)<Input id={`${id}-name`} required maxLength={100} value={values.name} disabled={save.isPending} onChange={(e) => update("name", e.target.value)} /></label>
    <label className="block space-y-2 text-sm" htmlFor={`${id}-description`}>Description<textarea id={`${id}-description`} className="event-textarea" rows={3} maxLength={4000} value={values.description} disabled={save.isPending} onChange={(e) => update("description", e.target.value)} /></label>
    <p className="text-sm text-muted-foreground">Times use your local timezone: {timezone}. For repeated daylight-saving times, your browser chooses the earlier occurrence.</p>
    <div className="invite-settings-grid">
      {([{ key: "startDate", label: "Start date", type: "date" }, { key: "startTime", label: "Start time", type: "time" }, { key: "endDate", label: "End date (optional)", type: "date" }, { key: "endTime", label: "End time (optional)", type: "time" }] as const).map(({ key, label, type }) => <label key={key} className="block space-y-2 text-sm" htmlFor={`${id}-${key}`}>{label}<Input id={`${id}-${key}`} type={type} required={key.startsWith("start")} value={values[key]} disabled={save.isPending} onChange={(e) => update(key, e.target.value)} /></label>)}
    </div>
    <label className="block space-y-2 text-sm" htmlFor={`${id}-location`}>Location or external link (required)<Input id={`${id}-location`} required maxLength={500} placeholder="A meeting place or https://…" value={values.location} disabled={save.isPending} onChange={(e) => update("location", e.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {save.error && <ApiNotice error={save.error} />}
    <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : existing ? "Save changes" : "Create Event"}</Button>
  </form>;
}
export function EventDialog({ community, existing, children, open, onOpenChange, returnFocusRef }: {
  community: Community; existing?: ServerEvent; children?: ReactElement; open?: boolean; onOpenChange?: (open: boolean) => void; returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [internal, setInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const setOpen = (value: boolean) => { setInternal(value); onOpenChange?.(value); };
  return <Dialog.Root open={open ?? internal} onOpenChange={(value) => { if (!saving) setOpen(value); }}>
    {children && <Dialog.Trigger asChild>{children}</Dialog.Trigger>}
    <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="standard-dialog event-dialog" onCloseAutoFocus={(event) => {
      if (returnFocusRef?.current) { event.preventDefault(); returnFocusRef.current.focus(); }
    }}>
      <Dialog.Title className="text-xl font-semibold">{existing ? "Edit event" : "Create event"}</Dialog.Title>
      <Dialog.Description className="mt-2 text-sm text-muted-foreground">{community.name} · Plan an event at a custom location or external link.</Dialog.Description>
      <EventForm community={community} existing={existing} onSaved={() => setOpen(false)} onBusyChange={setSaving} />
      <Dialog.Close asChild><button className="icon-button dialog-close" disabled={saving} aria-label="Close event dialog"><X size={20} aria-hidden="true" /></button></Dialog.Close>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
