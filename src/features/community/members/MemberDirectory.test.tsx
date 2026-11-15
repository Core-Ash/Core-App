import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AppDataProvider } from "@/app/AppDataProvider";
import { AuthContext } from "@/features/auth/auth-context";
import { MemberDirectory } from "@/features/community/members/MemberDirectory";
import { CommunityMembers } from "@/features/community/components/CommunityMembers";
import { channelFixture, communityFixture, memberPageFixture, profileFixture } from "@/test/api-fixtures";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";

vi.mock("@/lib/env", () => ({ apiConfiguration: { url: "/api/v1", configured: true, error: null } }));
afterEach(() => vi.unstubAllGlobals());
function provider(children: ReactNode) {
  return <AuthContext.Provider value={{ ...signedOutState, session: sessionFixture }}><AppDataProvider>{children}</AppDataProvider></AuthContext.Provider>;
}
function setup(children: ReactNode = <MemberDirectory communityId={communityFixture.id} channelId={channelFixture.id} />) {
  const request = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(async (url) => Response.json({ ...memberPageFixture, channel_id: url.includes("/channels/") ? channelFixture.id : null }));
  vi.stubGlobal("fetch", request);
  return { request, ...render(provider(children)) };
}

describe("member directories", () => {
  it("loads channel-visible profiles and avatars, groups by role, and opens a shared profile without presence guesses", async () => {
    vi.stubGlobal("Image", vi.fn(function () {
      const image = document.createElement("img");
      Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 64 } });
      return image;
    }));
    const { request } = setup();
    request.mockResolvedValueOnce(Response.json({ ...memberPageFixture, items: [{ ...memberPageFixture.items[0], avatar_url: "https://cdn.example.com/member.png" }] }));
    // Refresh confirms the avatar after the first already-started request.
    await screen.findByText(profileFixture.display_name);
    fireEvent.click(screen.getByRole("button", { name: "Refresh members" }));
    await waitFor(() => expect(document.querySelector('img[src="https://cdn.example.com/member.png"]')).toBeInTheDocument());
    const trigger = screen.getByRole("button", { name: `View profile for ${profileFixture.display_name}` });
    expect(screen.getByText(`@${profileFixture.username}`)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Member members" })).toBeInTheDocument();
    expect(screen.queryByText(/online|offline|playing/i)).not.toBeInTheDocument();
    const url = request.mock.calls[0]![0];
    expect(url).toBe(`/api/v1/communities/${communityFixture.id}/channels/${channelFixture.id}/members?search=&limit=50`);
    expect(request.mock.calls[0]![1]).toMatchObject({ credentials: "include", signal: expect.any(AbortSignal) });
    fireEvent.click(trigger);
    const card = screen.getByRole("dialog", { name: profileFixture.display_name });
    expect(within(card).getByText(profileFixture.id)).toBeInTheDocument();
    expect(within(card).getByText("Joined community")).toBeInTheDocument();
    expect(within(card).getByText("Member")).toBeInTheDocument();
    fireEvent.keyDown(card, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("shows loading and empty states", async () => {
    let finish!: (response: Response) => void;
    const { request } = setup();
    await screen.findByText(profileFixture.display_name);
    request.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    // Search changes the query key, so obsolete rows are hidden while loading.
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Nobody" } });
    expect(screen.getByRole("status", { name: "Loading members" })).toBeInTheDocument();
    await waitFor(() => expect(finish).toBeDefined());
    await act(async () => { finish(Response.json({ ...memberPageFixture, items: [], total: 0 })); });
    expect(await screen.findByRole("heading", { name: "No matching members" })).toBeInTheDocument();
  });
  it("debounces server search and paginates using the exact cursor", async () => {
    const { request } = setup();
    await screen.findByText(profileFixture.display_name);
    request.mockResolvedValueOnce(Response.json({ ...memberPageFixture, total: 2, next_cursor: profileFixture.id }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Cor" } });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Core" } });
    expect(request).toHaveBeenCalledOnce();
    const more = await screen.findByRole("button", { name: "Load more members" });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]![0]).toContain("search=Core");
    request.mockResolvedValueOnce(Response.json({ ...memberPageFixture, total: 2, items: [{ ...memberPageFixture.items[0],
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", display_name: "Second Core Member", username: "second_member", roles: [],
    }] }));
    fireEvent.click(more);
    await screen.findByText("Second Core Member");
    expect(screen.getByText(profileFixture.display_name)).toBeInTheDocument();
    expect(request.mock.calls.at(-1)![0]).toContain(`after_id=${profileFixture.id}`);
    expect(screen.queryByRole("button", { name: "Load more members" })).not.toBeInTheDocument();
  });
  it("drops cached private rows on permission failure and supports retry", async () => {
    const { request } = setup();
    await screen.findByText(profileFixture.display_name);
    request.mockResolvedValueOnce(new Response(null, { status: 403 }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh members" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("don't have permission");
    expect(screen.queryByText(profileFixture.display_name)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(profileFixture.display_name)).toBeInTheDocument();
  });
  it("cancels old channel/community loads and ignores a late response after navigation", async () => {
    const { request, rerender } = setup();
    await screen.findByText(profileFixture.display_name);
    let finish!: (response: Response) => void;
    request.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh members" }));
    await waitFor(() => expect(finish).toBeDefined());
    const signal = request.mock.calls.at(-1)![1]!.signal as AbortSignal;
    const nextCommunity = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const nextChannel = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    request.mockResolvedValueOnce(Response.json({ ...memberPageFixture, community_id: nextCommunity, channel_id: nextChannel, items: [], total: 0 }));
    rerender(provider(<MemberDirectory communityId={nextCommunity} channelId={nextChannel} />));
    expect(signal.aborted).toBe(true);
    await screen.findByText("No members to show");
    await act(async () => { finish(Response.json(memberPageFixture)); });
    expect(screen.queryByText(profileFixture.display_name)).not.toBeInTheDocument();
  });
  it("invalidates community members after confirmed admission", async () => {
    const { request } = setup(<CommunityMembers community={communityFixture} profile={profileFixture} />);
    request.mockImplementation(async (url, options) => options?.method === "POST" ? new Response(null, { status: 201 })
      : Response.json({ ...memberPageFixture, channel_id: null, total: url.includes("/members") ? 2 : 1 }));
    await screen.findByText(profileFixture.display_name);
    const form = screen.getByRole("form", { name: "Add community member" });
    fireEvent.change(within(form).getByRole("textbox"), { target: { value: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" } });
    const before = request.mock.calls.length;
    fireEvent.submit(form);
    await waitFor(() => expect(request.mock.calls.length).toBe(before + 2));
    expect(await within(form).findByRole("status")).toHaveTextContent("Member added");
    expect(request.mock.calls[0]![0]).not.toContain("/channels/");
  });
});
