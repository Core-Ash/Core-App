import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataProvider } from "@/app/AppDataProvider";
import { AuthContext } from "@/features/auth/auth-context";
import { ChannelAccess, ChannelSettings } from "@/features/community/access/ChannelSettings";
import { CommunityMembers } from "@/features/community/components/CommunityMembers";
import { accessRoleId, channelAccessFixture, channelFixture, communityFixture, memberPageFixture, profileFixture } from "@/test/api-fixtures";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";
import type { ReactNode } from "react";

vi.mock("@/lib/env", () => ({ apiConfiguration: { url: "/api/v1", configured: true, error: null } }));
afterEach(() => vi.unstubAllGlobals());
function provider(children: ReactNode) {
  return <AuthContext.Provider value={{ ...signedOutState, session: sessionFixture }}>
    <AppDataProvider>{children}</AppDataProvider>
  </AuthContext.Provider>;
}
function setup(children: ReactNode = <ChannelSettings community={communityFixture} channel={channelFixture} />) {
  const request = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(async (url) => Response.json(url.endsWith("/members?search=&limit=50") ? { ...memberPageFixture, channel_id: null } : channelAccessFixture));
  vi.stubGlobal("fetch", (url: string, options?: RequestInit) => url.includes("/permission-resources/") ? Promise.resolve(Response.json({ version: "fixture", resource: { name: "general" }, entries: [], roles: [], members: [] })) : request(url, options));
  return { request, ...render(provider(children)) };
}
async function openViewer() {
  fireEvent.click(screen.getByRole("button", { name: "Channel settings" }));
  expect(screen.getByRole("region", { name: "Permissions" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View Channel Access" }));
}

describe("channel access settings", () => {
  it("fetches only when opened, shows server explanations, and restores focus on close", async () => {
    const { request } = setup();
    expect(request).not.toHaveBeenCalled();
    await openViewer();
    expect(await screen.findByText("2 members can view this channel")).toBeInTheDocument();
    expect(screen.getByText("Community owner")).toBeInTheDocument();
    expect(screen.getByText(`@${profileFixture.username}`)).toBeInTheDocument();
    expect(screen.getByText("inherited")).toBeInTheDocument();
    expect(screen.getByText("3 members")).toBeInTheDocument();
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]![0]).toBe(`/api/v1/communities/${communityFixture.id}/channels/${channelFixture.id}/access?limit=50&search=&access=allowed`);
    expect(request.mock.calls[0]![1]).toMatchObject({ credentials: "include", method: "GET", signal: expect.any(AbortSignal) });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Channel settings" })).toHaveFocus());
  });
  it("shows a skeleton, uses server search after debounce, and sends role and denied filters", async () => {
    const { request } = setup();
    await openViewer();
    await screen.findByText(profileFixture.display_name);
    const search = screen.getByRole("searchbox", { name: "Search members" });
    fireEvent.change(search, { target: { value: "Gam" } });
    fireEvent.change(search, { target: { value: "Gamer" } });
    expect(screen.getByRole("status", { name: "Loading channel access" })).toBeInTheDocument();
    expect(screen.queryByText(profileFixture.display_name)).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledOnce();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(new URL(request.mock.calls[1]![0], "https://core.test").searchParams.get("search")).toBe("Gamer");
    await screen.findByText(profileFixture.display_name);
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by role" }), { target: { value: accessRoleId } });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    expect(request.mock.calls[2]![0]).toContain(`role_id=${accessRoleId}`);
    await screen.findByText(profileFixture.display_name);
    request.mockResolvedValueOnce(Response.json({ ...channelAccessFixture, filtered_total: 0, items: [] }));
    fireEvent.click(screen.getByRole("button", { name: /Without access/ }));
    expect(await screen.findByText("No matching members")).toBeInTheDocument();
    expect(request.mock.calls.at(-1)![0]).toContain("access=denied");
    expect(request.mock.calls.at(-1)![0]).toContain(`role_id=${accessRoleId}`);
  });
  it("paginates with the backend cursor and preserves all access sources", async () => {
    const { request } = setup();
    request.mockResolvedValueOnce(Response.json({ ...channelAccessFixture, next_cursor: profileFixture.id }));
    await openViewer();
    const button = await screen.findByRole("button", { name: "Load more members" });
    request.mockResolvedValueOnce(Response.json({ ...channelAccessFixture, items: [{
      ...channelAccessFixture.items[0], id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", display_name: "Gamer Two", username: "gamer_two",
      sources: [{ kind: "member_allow" }, { kind: "role_allow", role_id: accessRoleId, role_name: "Member" }],
    }] }));
    fireEvent.click(button);
    await screen.findByText("Gamer Two");
    expect(screen.getByText(profileFixture.display_name)).toBeInTheDocument();
    expect(screen.getByText("Explicit member allow")).toBeInTheDocument();
    expect(screen.getByText("Channel allow through Member")).toBeInTheDocument();
    expect(request.mock.calls.at(-1)![0]).toContain(`after_id=${profileFixture.id}`);
    expect(screen.getByText("Showing 2 of 2 matching members")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more members" })).not.toBeInTheDocument();
  });
  it("hides cached private results after permission is revoked", async () => {
    const { request } = setup();
    await openViewer();
    await screen.findByText(profileFixture.display_name);
    request.mockResolvedValueOnce(new Response(null, { status: 403 }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh access" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("don't have permission");
    expect(screen.queryByText(profileFixture.display_name)).not.toBeInTheDocument();
    expect(screen.queryByText("3 members")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    let finish!: (response: Response) => void;
    request.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(finish).toBeDefined());
    expect(screen.queryByText(profileFixture.display_name)).not.toBeInTheDocument();
    await act(async () => { finish(Response.json(channelAccessFixture)); });
    expect(await screen.findByText(profileFixture.display_name)).toBeInTheDocument();
  });
  it("cancels the previous channel request and never shows its late result", async () => {
    const { request, rerender } = setup(<ChannelAccess communityId={communityFixture.id} channelId={channelFixture.id} />);
    // The initial request runs during render. Replace it before a second navigation.
    await screen.findByText(profileFixture.display_name);
    let finish!: (response: Response) => void;
    request.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh access" }));
    await waitFor(() => expect(finish).toBeDefined());
    const signal = request.mock.calls.at(-1)![1]!.signal as AbortSignal;
    const nextChannelId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    request.mockResolvedValueOnce(Response.json({ ...channelAccessFixture, channel: { ...channelAccessFixture.channel, id: nextChannelId }, items: [] }));
    rerender(provider(<ChannelAccess communityId={communityFixture.id} channelId={nextChannelId} />));
    expect(signal.aborted).toBe(true);
    await screen.findByText("No matching members");
    await act(async () => { finish(Response.json(channelAccessFixture)); });
    expect(screen.queryByText(profileFixture.display_name)).not.toBeInTheDocument();
  });
  it("preserves channel access inspection alongside member administration without reference admission", async () => {
    setup(<>
      <ChannelAccess communityId={communityFixture.id} channelId={channelFixture.id} />
      <CommunityMembers community={communityFixture} profile={profileFixture} />
    </>);
    await screen.findByText("2 members can view this channel");
    expect(screen.queryByRole("form", { name: "Add community member" })).not.toBeInTheDocument();
  });
});
