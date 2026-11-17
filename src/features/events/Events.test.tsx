import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataProvider } from "@/app/AppDataProvider";
import { AuthContext } from "@/features/auth/auth-context";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";
import { communityFixture } from "@/test/api-fixtures";
import { EventDialog } from "@/features/events/EventDialog";
import { ServerEvents } from "@/features/events/ServerEvents";
import { eventLocationHref, localDateTime, utcDateTime } from "@/features/events/dates";
import { parseEvent } from "@/features/events/api";
import type { ReactNode } from "react";

vi.mock("@/lib/env", () => ({ apiConfiguration: { url: "/api/v1", configured: true, error: null } }));
const eventId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const eventFixture = { id: eventId, community_id: communityFixture.id, name: "Game night", description: "Bring your squad", location: "https://example.com/event", starts_at: "2031-11-20T18:00:00.000Z", ends_at: null, status: "scheduled", creator: "Ash", created_at: "2026-11-17T10:00:00Z", updated_at: "2026-11-17T10:00:00Z" };
afterEach(() => vi.unstubAllGlobals());
function Location() { const location = useLocation(); return <output data-testid="location">{location.search}</output>; }
function setup(children: ReactNode, handler: (url: string, options: RequestInit) => Promise<Response>, path = "/app") {
  const request = vi.fn(async (url: string, options: RequestInit = {}) => handler(url, options)); vi.stubGlobal("fetch", request);
  render(<AuthContext.Provider value={{ ...signedOutState, session: sessionFixture }}><AppDataProvider><MemoryRouter initialEntries={[path]}>{children}<Location /></MemoryRouter></AppDataProvider></AuthContext.Provider>);
  return request;
}
function fillForm() {
  fireEvent.change(screen.getByLabelText("Event name (required)"), { target: { value: "Game night" } });
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2031-11-20" } });
  fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "19:00" } });
  fireEvent.change(screen.getByLabelText("Location or external link (required)"), { target: { value: "Our cafe" } });
}
describe("server events", () => {
  it("converts local fields to UTC, blocks duplicate submits, and opens the persisted event", async () => {
    let finish!: (response: Response) => void;
    const request = setup(<EventDialog community={communityFixture} open />, async () => new Promise<Response>((resolve) => { finish = resolve; }));
    fillForm(); const form = screen.getByRole("form", { name: "Create server event" });
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe(`/api/v1/communities/${communityFixture.id}/events`);
    const payload = JSON.parse(String(options?.body));
    expect(payload.starts_at).toBe(utcDateTime("2031-11-20T19:00"));
    expect(payload.ends_at).toBeNull(); expect(payload.client_nonce).toMatch(/^[a-f0-9-]{36}$/i);
    await act(async () => finish(Response.json({ ...eventFixture, ...payload })));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(`view=events&event=${eventId}`));
  });
  it("validates end dates before making requests", () => {
    const request = setup(<EventDialog community={communityFixture} open />, async () => Response.json(eventFixture)); fillForm();
    fireEvent.change(screen.getByLabelText("End date (optional)"), { target: { value: "2031-11-19" } });
    fireEvent.change(screen.getByLabelText("End time (optional)"), { target: { value: "18:00" } });
    fireEvent.submit(screen.getByRole("form")); expect(screen.getByRole("alert")).toHaveTextContent("after the start"); expect(request).not.toHaveBeenCalled();
  });
  it("edits an existing event through PATCH without creating another event", async () => {
    const existing = parseEvent(eventFixture);
    const request = setup(<EventDialog community={communityFixture} existing={existing} open />, async (_url, options) => Response.json({ ...eventFixture, ...JSON.parse(String(options.body)) }));
    expect(screen.getByLabelText("Event name (required)")).toHaveValue("Game night");
    fireEvent.change(screen.getByLabelText("Event name (required)"), { target: { value: "Updated game night" } });
    fireEvent.submit(screen.getByRole("form", { name: "Edit server event" }));
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(request.mock.calls[0]?.[0]).toBe(`/api/v1/communities/${communityFixture.id}/events/${eventId}`);
    expect(request.mock.calls[0]?.[1]).toMatchObject({ method: "PATCH" });
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).not.toHaveProperty("client_nonce");
  });
  it("preserves the nonce and values when retrying a failed create", async () => {
    const request = setup(<EventDialog community={communityFixture} open />, async () => new Response(null, { status: 503 })); fillForm();
    fireEvent.submit(screen.getByRole("form")); await screen.findByRole("alert");
    expect(screen.getByLabelText("Event name (required)")).toHaveValue("Game night");
    fireEvent.submit(screen.getByRole("form")); await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).client_nonce).toBe(JSON.parse(String(request.mock.calls[1]?.[1]?.body)).client_nonce);
  });
  it("shows real event details and cancels through the scoped API", async () => {
    let cancelled = false;
    const request = setup(<ServerEvents community={communityFixture} />, async (url, options) => {
      if (url.endsWith("/event-permissions")) return Response.json({ create: true, manage: true });
      if (options.method === "DELETE") { cancelled = true; return new Response(null, { status: 204 }); }
      const event = { ...eventFixture, status: cancelled ? "cancelled" : "scheduled" };
      return Response.json(url.endsWith(`/events/${eventId}`) ? event : { items: [event], next_cursor: null });
    });
    fireEvent.click(await screen.findByRole("button", { name: "Open event: Game night" }));
    await screen.findByRole("dialog", { name: "Game night" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel event" })); fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    await screen.findByText("Event cancelled");
    expect(request.mock.calls.some(([url, options]) => url.endsWith(`/events/${eventId}`) && options?.method === "DELETE")).toBe(true);
    expect(screen.getByRole("dialog").textContent).not.toContain(eventId);
  });
  it("does not offer event creation without permission", async () => {
    setup(<ServerEvents community={communityFixture} />, async (url) => Response.json(url.endsWith("permissions") ? { create: false, manage: false } : { items: [], next_cursor: null }));
    await screen.findByText(/No upcoming events/); expect(screen.queryByRole("button", { name: "Create Event" })).not.toBeInTheDocument();
  });
  it("shows service errors without placeholder events", async () => {
    setup(<ServerEvents community={communityFixture} />, async (url) => url.endsWith("permissions") ? Response.json({ create: false, manage: false }) : new Response(null, { status: 503 }));
    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable"); expect(screen.queryByText("Game night")).not.toBeInTheDocument();
  });
});
describe("event boundary helpers", () => {
  it("round-trips local dates through UTC and rejects impossible dates", () => {
    const local = "2031-11-20T19:30", iso = utcDateTime(local);
    expect(iso).not.toBeNull(); expect(localDateTime(iso!)).toBe(local);
    expect(utcDateTime("2031-02-30T19:00")).toBeNull(); expect(utcDateTime("not a date")).toBeNull();
  });
  it("renders only safe external links", () => {
    expect(eventLocationHref("javascript:alert(1)")).toBeNull(); expect(eventLocationHref("Our cafe")).toBeNull();
    expect(eventLocationHref("https://user:pass@example.com")).toBeNull(); expect(eventLocationHref("https://example.com/event")).toBe("https://example.com/event");
  });
  it("rejects malformed event data", () => {
    expect(() => parseEvent({ ...eventFixture, ends_at: "2020-01-01T00:00:00Z" })).toThrow();
    expect(() => parseEvent({ ...eventFixture, status: "fake" })).toThrow();
  });
});
