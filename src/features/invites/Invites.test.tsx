import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { AuthContext, type AuthContextValue } from "@/features/auth/auth-context";
import { AppDataProvider } from "@/app/AppDataProvider";
import { InvitePage } from "@/features/invites/InvitePage";
import { InviteDialog } from "@/features/invites/InviteDialog";
import { InviteManagement } from "@/features/invites/InviteManagement";
import { parseCreatedInvite, parsePreview } from "@/features/invites/api";
import { getReturnPath } from "@/features/auth/return-path";
import { communityFixture } from "@/test/api-fixtures";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";
import { queryKeys } from "@/features/community/api/hooks";

vi.mock("@/lib/env", () => ({ apiConfiguration: { url: "/api/v1", configured: true, error: null } }));
const code = "a".repeat(64), id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const preview = { server: { name: "Dragons Den", description: "A place for our squad", icon_url: null, banner_url: null, member_count: 42 }, expires_at: null };
const created = { id, code, url: `https://core.example.com/invite/${code}`, expires_at: null, uses: 0, max_uses: null };
const permissions = { create: true, manage: true, manage_channels: true, owner: true };
afterEach(() => vi.unstubAllGlobals());
function Location() { const location = useLocation(); return <output data-testid="location">{JSON.stringify(location)}</output>; }
function Capture({ capture }: { capture: (queries: QueryClient) => void }) {
  const queries = useQueryClient(); useEffect(() => capture(queries), [queries, capture]); return null;
}
function setup({ auth = signedOutState, children, handler }: { auth?: AuthContextValue; children?: ReactNode; handler?: (url: string, options: RequestInit) => Promise<Response> } = {}) {
  let queries!: QueryClient;
  const request = vi.fn(async (url: string, options: RequestInit = {}) => {
    if (handler) return handler(url, options);
    if (url.endsWith("/status")) return Response.json({ already_member: false, community_id: null });
    return Response.json(preview);
  });
  vi.stubGlobal("fetch", request);
  const view = render(<AuthContext.Provider value={auth}><AppDataProvider><MemoryRouter initialEntries={[`/invite/${code}`]}>
    <Capture capture={(client) => { queries = client; }} />
    {children ?? <Routes><Route path="/invite/:code" element={<InvitePage />} /><Route path="*" element={<p>Destination</p>} /></Routes>}
    <Location />
  </MemoryRouter></AppDataProvider></AuthContext.Provider>);
  return { request, ...view, get queries() { return queries; } };
}
const signedIn = { ...signedOutState, session: sessionFixture };
describe("link invitations", () => {
  it("shows a public preview without cookies and never joins when opened", async () => {
    const { request } = setup();
    await screen.findByRole("heading", { name: "Dragons Den" });
    expect(screen.getByText("42 Members")).toBeInTheDocument();
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]?.[1]).toMatchObject({ credentials: "omit", method: "GET", referrerPolicy: "no-referrer" });
    fireEvent.click(screen.getByRole("link", { name: "Sign In to Join" }));
    expect(screen.getByTestId("location")).toHaveTextContent('"pathname":"/login"');
    expect(screen.getByTestId("location")).toHaveTextContent(`"from":"/invite/${code}"`);
  });
  it("preserves the destination for registration", async () => {
    setup();
    fireEvent.click(await screen.findByRole("link", { name: "Create an account" }));
    expect(screen.getByTestId("location")).toHaveTextContent('"pathname":"/register"');
    expect(screen.getByTestId("location")).toHaveTextContent(`/invite/${code}`);
  });
  it("waits for session initialization before offering authentication or acceptance", async () => {
    const { request } = setup({ auth: { ...signedOutState, pending: true } });
    await screen.findByRole("heading", { name: "Dragons Den" });
    expect(screen.getByText("Checking your session…")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign In to Join" })).not.toBeInTheDocument();
    expect(request.mock.calls.every(([, options]) => options?.method === "GET")).toBe(true);
  });
  it("joins only on click, onboards through Rust, invalidates the sidebar cache, then selects the server", async () => {
    const { request, queries } = setup({ auth: signedIn, handler: async (url) => {
      if (url.endsWith("/status")) return Response.json({ already_member: false, community_id: null });
      if (url.endsWith("/accept")) return Response.json({ already_member: false, community_id: communityFixture.id });
      if (url.endsWith("/me")) return Response.json({});
      return Response.json(preview);
    } });
    const join = await screen.findByRole("button", { name: "Join Server" });
    expect(request.mock.calls.every(([, options]) => options?.method === "GET")).toBe(true);
    queries.setQueryData(queryKeys.communities, []);
    fireEvent.click(join);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(`community=${communityFixture.id}`));
    expect(request.mock.calls.filter(([, options]) => options?.method === "POST").map(([url]) => url)).toEqual(["/api/v1/me", `/api/v1/invites/${code}/accept`]);
    expect(queries.getQueryState(queryKeys.communities)?.isInvalidated).toBe(true);
    expect(request.mock.calls.find(([url]) => url.endsWith("/accept"))?.[1]).toMatchObject({ credentials: "include", headers: expect.objectContaining({ "X-Core-CSRF": "1" }) });
  });
  it("lets a newly registered user join after a missing-profile response", async () => {
    const { request } = setup({ auth: signedIn, handler: async (url) => {
      if (url.endsWith("/status")) return new Response(null, { status: 409 });
      if (url.endsWith("/me")) return Response.json({});
      if (url.endsWith("/accept")) return Response.json({ already_member: false, community_id: communityFixture.id });
      return Response.json(preview);
    } });
    fireEvent.click(await screen.findByRole("button", { name: "Join Server" }));
    await waitFor(() => expect(request.mock.calls.some(([url]) => url.endsWith("/accept"))).toBe(true));
  });
  it("offers Open Server to existing members even when the last use was consumed", async () => {
    const { request } = setup({ auth: signedIn, handler: async (url) => url.endsWith("/status")
      ? Response.json({ already_member: true, community_id: communityFixture.id }) : new Response(null, { status: 404 }) });
    expect(await screen.findByRole("heading", { name: "Already a member" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Server" })).toHaveAttribute("href", `/app?community=${communityFixture.id}`);
    expect(request.mock.calls.every(([, options]) => options?.method === "GET")).toBe(true);
  });
  it("shows invalid invites separately from temporary failures", async () => {
    setup({ handler: async () => new Response(null, { status: 404 }) });
    expect(await screen.findByRole("heading", { name: "Invite Invalid" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
  it("offers retry after a network error without claiming the invitation is invalid", async () => {
    let failed = true;
    setup({ handler: async () => { if (failed) throw new TypeError("offline"); return Response.json(preview); } });
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.queryByText("Invite Invalid")).not.toBeInTheDocument();
    failed = false; fireEvent.click(retry);
    await screen.findByRole("heading", { name: "Dragons Den" });
  });
  it("keeps banned/forbidden users out and never accepts automatically", async () => {
    const { request } = setup({ auth: signedIn, handler: async (url) => url.endsWith("/status") ? new Response(null, { status: 403 }) : Response.json(preview) });
    expect(await screen.findByRole("alert")).toHaveTextContent("don't have permission");
    expect(screen.getByRole("button", { name: "Join Server" })).toBeDisabled();
    expect(request.mock.calls.every(([, options]) => options?.method === "GET")).toBe(true);
  });
  it("does not generate on open, copies an explicitly created link, and reuses it on reopen", async () => {
    const clipboard = { writeText: vi.fn(async () => {}) }; vi.stubGlobal("navigator", { ...navigator, clipboard });
    const { request } = setup({ auth: signedIn, children: <InviteDialog community={communityFixture}><button>Invite People</button></InviteDialog>, handler: async (_url, options) => Response.json(options?.method === "POST" ? created : preview) });
    fireEvent.click(screen.getByRole("button", { name: "Invite People" }));
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Edit invite link" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Expiration" }), { target: { value: "3600" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Maximum uses" }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate Invite Link" }));
    const copy = await screen.findByRole("button", { name: "Copy Link" });
    await waitFor(() => expect(copy).toBeEnabled()); fireEvent.click(copy);
    await screen.findByText("Link copied.");
    expect(clipboard.writeText).toHaveBeenCalledWith(created.url);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({ expires_in_seconds: 3600, max_uses: 5 });
    fireEvent.click(screen.getByRole("button", { name: "Close invitation dialog" }));
    fireEvent.click(screen.getByRole("button", { name: "Invite People" }));
    await screen.findByDisplayValue(created.url);
    expect(request.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  });
  it("opens link settings separately and cancels without creating an invitation", () => {
    const { request } = setup({ auth: signedIn, children: <InviteDialog community={communityFixture}><button>Invite People</button></InviteDialog> });
    fireEvent.click(screen.getByRole("button", { name: "Invite People" }));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit invite link" }));
    expect(screen.getByRole("dialog", { name: "Invite link settings" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Expiration" }), { target: { value: "3600" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog", { name: `Invite people to ${communityFixture.name}` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit invite link" }));
    expect(screen.getByRole("combobox", { name: "Expiration" })).toHaveValue("604800");
    expect(request).not.toHaveBeenCalled();
  });
  it("lists real response metadata and revokes without exposing identifiers", async () => {
    let revoked = false;
    const { request } = setup({ auth: signedIn, children: <InviteManagement community={communityFixture} />, handler: async (url, options) => {
      if (url.endsWith("/invite-permissions")) return Response.json(permissions);
      if (options?.method === "DELETE") { revoked = true; return new Response(null, { status: 204 }); }
      return Response.json({ items: [{ id, creator: "Ash", created_at: "2026-11-17T12:00:00Z", expires_at: null, max_uses: 5, uses: 3, status: revoked ? "revoked" : "active" }], next_cursor: null });
    } });
    const revoke = await screen.findByRole("button", { name: /Revoke invitation by Ash/ });
    expect(screen.getByText("3 / 5")).toBeInTheDocument(); expect(document.body).not.toHaveTextContent(id);
    fireEvent.click(revoke);
    await screen.findByText("revoked");
    expect(request.mock.calls.some(([url, options]) => url.endsWith(`/invites/${id}`) && options?.method === "DELETE")).toBe(true);
  });
  it("does not fetch invitations or show management actions without permission", async () => {
    const { request } = setup({ auth: signedIn, children: <InviteManagement community={communityFixture} />, handler: async () => Response.json({ ...permissions, create: false, manage: false }) });
    await screen.findByText(/don't have permission to manage/);
    expect(request).toHaveBeenCalledOnce(); expect(screen.queryByRole("button", { name: "Generate Invite Link" })).not.toBeInTheDocument();
  });
  it("clears invitation links when the session scope unmounts", async () => {
    const { queries, unmount } = setup();
    await screen.findByRole("heading", { name: "Dragons Den" });
    queries.setQueryData(["invite-link", communityFixture.id], created);
    await act(async () => unmount());
    expect(queries.getQueryData(["invite-link", communityFixture.id])).toBeUndefined();
  });
});
describe("invitation boundary validation", () => {
  it.each([`/invite/${code}`, "/app?community=hello"]) ("preserves safe destination %s", (path) => expect(getReturnPath({ from: path })).toBe(path));
  it.each(["https://evil.test", "//evil.test", "/invite/../login", `/invite/${code}?next=https://evil.test`, "/app\\evil", "/app\n", "/login"]) ("rejects unsafe destination %s", (path) => expect(getReturnPath({ from: path })).toBe("/app"));
  it("rejects malformed preview fields and unsafe generated URLs", () => {
    expect(() => parsePreview({ ...preview, server: { ...preview.server, member_count: -1 } })).toThrow();
    expect(() => parsePreview({ ...preview, server: { ...preview.server, icon_url: "javascript:alert(1)" } })).toThrow();
    expect(() => parseCreatedInvite({ ...created, url: "https://evil.test/login" })).toThrow();
    expect(() => parseCreatedInvite({ ...created, code: "guessable" })).toThrow();
  });
});
