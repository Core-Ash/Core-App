import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, X } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { ApiNotice } from "@/components/common/ApiNotice";
import { EventDialog } from "@/features/events/EventDialog";
import { useCancelEvent, useEvent, useEventPermissions, useEvents, type ServerEvent } from "@/features/events/api";
import { eventLocationHref } from "@/features/events/dates";
import { communityHref } from "@/features/community/api/use-community-selection";
import type { Community } from "@/lib/api/types";

function EventDescription({ event }: { event: ServerEvent }) {
  const href = eventLocationHref(event.location);
  return <div className="space-y-3 break-words">
    <p className="text-sm text-muted-foreground">{event.status === "cancelled" ? "Cancelled" : "Scheduled"} · Hosted by {event.creator}</p>
    <p><time dateTime={event.starts_at}>{new Date(event.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
      {event.ends_at && <> – <time dateTime={event.ends_at}>{new Date(event.ends_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></>}</p>
    <p className="whitespace-pre-wrap">{event.description}</p>
    <p>{href ? <a className="text-link underline" href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{event.location}</a> : event.location}</p>
  </div>;
}
function EventDetails({ community, eventId, close, edit, returnFocusRef }: {
  community: Community; eventId: string; close: () => void; edit: (event: ServerEvent) => void; returnFocusRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const detail = useEvent(community.id, eventId), permissions = useEventPermissions(community.id), cancel = useCancelEvent(community.id);
  const [confirm, setConfirm] = useState(false);
  const [openedAt] = useState(() => Date.now());
  return <Dialog.Root open onOpenChange={(value) => { if (!value) close(); }}><Dialog.Portal>
    <Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="standard-dialog event-dialog" onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusRef.current?.focus(); }}>
      <Dialog.Title className="text-xl font-semibold break-words">{detail.isSuccess ? detail.data.name : "Event details"}</Dialog.Title>
      <Dialog.Description className="mt-2 mb-5 text-sm text-muted-foreground">{community.name} · Times are shown in your local timezone.</Dialog.Description>
      {detail.isPending && <p role="status">Loading event…</p>}
      {detail.error && <ApiNotice error={detail.error} onRetry={() => { void detail.refetch(); }} />}
      {detail.isSuccess && <>
        <EventDescription event={detail.data} />
        {permissions.isSuccess && permissions.data.manage && detail.data.status === "scheduled" && <div className="mt-5 flex flex-wrap gap-3">
          {Date.parse(detail.data.starts_at) > openedAt && <Button variant="outline" onClick={() => edit(detail.data)}>Edit event</Button>}
          {confirm ? <><Button disabled={cancel.isPending} onClick={() => cancel.mutate(eventId)}>{cancel.isPending ? "Cancelling…" : "Confirm cancellation"}</Button><Button variant="outline" disabled={cancel.isPending} onClick={() => setConfirm(false)}>Keep event</Button></>
            : <Button variant="outline" onClick={() => setConfirm(true)}>Cancel event</Button>}
        </div>}
      </>}
      {cancel.error && <ApiNotice error={cancel.error} />}
      {cancel.isSuccess && <p role="status" className="mt-4">Event cancelled</p>}
      <Dialog.Close asChild><button className="icon-button dialog-close" aria-label="Close event details"><X size={20} aria-hidden="true" /></button></Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
export function ServerEvents({ community }: { community: Community }) {
  const events = useEvents(community.id), permissions = useEventPermissions(community.id);
  const [params, setParams] = useSearchParams(), location = useLocation();
  const [editing, setEditing] = useState<ServerEvent | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = params.get("event");
  const notice = location.state as { eventNotice?: unknown } | null;
  function closeDetails() { const next = new URLSearchParams(params); next.delete("event"); setParams(next, { replace: true }); }
  return <section className="server-events p-6 space-y-5" aria-label={`${community.name} events`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold" tabIndex={-1} ref={heading}>Server Events</h1>
      {permissions.isSuccess && permissions.data.create && <EventDialog community={community}><Button>Create Event</Button></EventDialog>}
    </div>
    <Link className="text-sm text-link" to={communityHref(community.id)}>Back to channels</Link>
    {typeof notice?.eventNotice === "string" && ["Event created", "Event updated"].includes(notice.eventNotice) && <p role="status">{notice.eventNotice}</p>}
    {permissions.error && <ApiNotice error={permissions.error} onRetry={() => { void permissions.refetch(); }} />}
    {events.isPending && <p role="status">Loading events…</p>}
    {events.error && <ApiNotice error={events.error} onRetry={() => { void events.refetch(); }} />}
    {events.isSuccess && <>
      {events.data.pages.some((page) => page.items.length) ? <ul className="event-grid" aria-label="Upcoming server events">
        {events.data.pages.flatMap((page) => page.items).map((event) => <li key={event.id} className="event-card space-y-3">
          <CalendarDays size={24} className="text-primary" aria-hidden="true" /><h2 className="text-lg font-semibold break-words">{event.name}</h2>
          <EventDescription event={event} /><Button variant="outline" onClick={() => { const next = new URLSearchParams(params); next.set("event", event.id); setParams(next); }}>Open event<span className="sr-only">: {event.name}</span></Button>
        </li>)}
      </ul> : <p className="text-muted-foreground">No upcoming events. New server events will appear here.</p>}
      {events.hasNextPage && <Button variant="outline" disabled={events.isFetchingNextPage} onClick={() => { void events.fetchNextPage(); }}>Load more events</Button>}
    </>}
    {selected && <EventDetails key={selected} community={community} eventId={selected} close={closeDetails} returnFocusRef={heading} edit={(event) => { closeDetails(); setEditing(event); }} />}
    {editing && <EventDialog community={community} existing={editing} open onOpenChange={(value) => { if (!value) setEditing(undefined); }} returnFocusRef={heading} />}
  </section>;
}
