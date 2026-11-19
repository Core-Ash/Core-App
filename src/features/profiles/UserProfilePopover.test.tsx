import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode, type ReactNode } from "react";
import { AppDataContext } from "@/app/app-data-context";
import { createApiClient } from "@/lib/api/client";
import { profileFixture, memberPageFixture, communityFixture } from "@/test/api-fixtures";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import { ChatMessage } from "@/features/community/components/ChatMessage";
import { GroupMemberList } from "@/features/conversations/components/GroupMemberList";
import { ConversationHeader } from "@/features/conversations/components/ConversationHeader";
import type { ConversationDetail } from "@/lib/api/types";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AuthContext } from "@/features/auth/auth-context";
import { signedOutState } from "@/test/auth-fixture";
import { MemberDirectory } from "@/features/community/members/MemberDirectory";

const friend = { ...profileFixture, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", display_name: "Dragon", username: "Dragon", discriminator: "0024" };
const conversation: ConversationDetail = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", type: "direct", name: null, icon_url: null,
  created_by: profileFixture.id, role: "member", created_at: "2026-11-18T10:00:00Z", updated_at: "2026-11-18T10:00:00Z", last_message_at: "2026-11-18T10:00:00Z",
  members: [profileFixture, friend].map((profile) => ({ id: profile.id, profile, role: "member", joined_at: "2026-11-18T10:00:00Z" })),
};
function setup(children: ReactNode, path = "/") {
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/bootstrap")) return Response.json({ profile: profileFixture, communities: { items: [] } });
    if (url.includes("/members")) return Response.json({ ...memberPageFixture, channel_id: null, items: [{ ...memberPageFixture.items[0], ...friend }] });
    if (url.endsWith("/conversations")) return Response.json({ items: [{ ...conversation, hidden: false, last_message: null }] });
    return Response.json({ state: "friends", request_id: null });
  });
  vi.stubGlobal("fetch", fetcher);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queries.setQueryData(["profile"], profileFixture);
  const api = createApiClient({ baseUrl: "https://core.test", sessionSignal: () => new AbortController().signal, onUnauthorized: async () => "active" });
  const view = (content: ReactNode) => <QueryClientProvider client={queries}><AppDataContext.Provider value={{ api, ready: true, configured: true, configurationError: null, clearPrivateData: vi.fn() }}><MemoryRouter initialEntries={[path]}>{content}</MemoryRouter></AppDataContext.Provider></QueryClientProvider>;
  const result = render(<StrictMode>{view(children)}</StrictMode>);
  return { fetcher, rerender: (content: ReactNode) => result.rerender(<StrictMode>{view(content)}</StrictMode>) };
}
afterEach(() => vi.unstubAllGlobals());

function LocationProbe() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}

describe("shared user profiles", () => {
  it("replaces the open profile and restores focus on Escape", async () => {
    setup(<><MemberIdentity profile={friend} /><MemberIdentity profile={profileFixture} /></>);
    fireEvent.click(screen.getByRole("button", { name: "View profile for Dragon" }));
    expect(await screen.findByRole("button", { name: "Remove Friend" })).toBeInTheDocument();
    const self = screen.getByRole("button", { name: `View profile for ${profileFixture.display_name}` });
    fireEvent.click(self);
    const card = screen.getByRole("dialog", { name: profileFixture.display_name });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(card).queryByRole("button", { name: "Block User" })).not.toBeInTheDocument();
    fireEvent.keyDown(card, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(self).toHaveFocus();
  });
  it("closes outside and when channel or conversation navigation changes", async () => {
    setup(<><MemberIdentity profile={friend} /><Link to="/app?channel=next">Next channel</Link></>);
    const trigger = screen.getByRole("button", { name: "View profile for Dragon" });
    fireEvent.click(trigger);
    await screen.findByRole("button", { name: "Remove Friend" });
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("link", { name: "Next channel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it.each([false, true])("opens message avatar profiles with grouped=%s without binding message content", async (grouped) => {
    const outer = vi.fn();
    setup(<div onClick={outer}><ChatMessage grouped={grouped} message={{ id: "message", body: "Selectable message", createdAt: "2026-11-18T10:00:00Z", author: { id: friend.id, name: friend.display_name, initials: "D", tone: "slate", profile: friend } }} /></div>);
    fireEvent.click(screen.getByText("Selectable message"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    outer.mockClear();
    const triggers = screen.getAllByRole("button", { name: "View profile for Dragon" });
    for (const trigger of triggers) {
      fireEvent.click(trigger.querySelector('[data-slot="avatar"]') ?? within(trigger).getByText(friend.display_name));
      expect(screen.getByRole("dialog", { name: "Dragon" })).toBeInTheDocument();
      expect(outer).not.toHaveBeenCalled();
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    }
  });
  it.each(["name", "avatar"])("opens the direct header and member list by %s, including self", async (part) => {
    setup(<><ConversationHeader conversation={conversation} currentUserId={profileFixture.id} membersVisible onToggleMembers={vi.fn()} search="" onSearch={vi.fn()} /><GroupMemberList conversationId={conversation.id} members={conversation.members} currentUserId={profileFixture.id} currentUserRole="member" /></>);
    const clickIdentity = (trigger: HTMLElement, name: string) => fireEvent.click(part === "avatar" ? trigger.querySelector('[data-slot="avatar"]')! : within(trigger).getByText(name));
    clickIdentity(screen.getAllByRole("button", { name: "View profile for Dragon" })[0]!, friend.display_name);
    expect(screen.getByRole("dialog", { name: "Dragon" })).toBeInTheDocument();
    clickIdentity(screen.getAllByRole("button", { name: "View profile for Dragon" })[1]!, friend.display_name);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    clickIdentity(screen.getByRole("button", { name: `View profile for ${profileFixture.display_name}` }), profileFixture.display_name);
    expect(screen.getByRole("dialog", { name: profileFixture.display_name })).toBeInTheDocument();
  });
  it.each(["name", "avatar"])("opens a server member profile by %s without navigating", async (part) => {
    const { fetcher } = setup(<><MemberDirectory communityId={communityFixture.id} /><LocationProbe /></>, "/app");
    const trigger = await screen.findByRole("button", { name: "View profile for Dragon" });
    fireEvent.click(part === "avatar" ? trigger.querySelector('[data-slot="avatar"]')! : within(trigger).getByText(friend.display_name));
    expect(screen.getByRole("dialog", { name: "Dragon" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/app");
    expect(fetcher.mock.calls.some(([url]) => url.endsWith("/conversations/direct"))).toBe(false);
  });
  it.each(["name", "avatar"])("opens the active DM sidebar profile by %s without navigating", async (part) => {
    const onNavigate = vi.fn();
    const { fetcher } = setup(<AuthContext.Provider value={signedOutState}><AppSidebar onNavigate={onNavigate} /><LocationProbe /></AuthContext.Provider>, `/app/messages/${conversation.id}`);
    const trigger = await screen.findByRole("button", { name: "View profile for Dragon" });
    fireEvent.click(part === "avatar" ? trigger.querySelector('[data-slot="avatar"]')! : within(trigger).getByText(friend.display_name));
    expect(screen.getByRole("dialog", { name: "Dragon" })).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Current route")).toHaveTextContent(`/app/messages/${conversation.id}`);
    expect(fetcher.mock.calls.some(([url]) => url.endsWith("/conversations/direct"))).toBe(false);
  });
  it("loads scoped community roles only when opened, and omits them in DMs", async () => {
    const { fetcher, rerender } = setup(<MemberIdentity profile={friend} communityId={communityFixture.id} />);
    expect(fetcher.mock.calls.some(([url]) => url.includes("/members"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "View profile for Dragon" }));
    expect(await screen.findByRole("region", { name: "Member roles" })).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/communities/${communityFixture.id}/members?search=Dragon`), expect.objectContaining({ credentials: "include" }));
    rerender(<MemberIdentity profile={friend} />);
    expect(screen.queryByRole("region", { name: "Member roles" })).not.toBeInTheDocument();
  });
});
