import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect, type ReactNode } from "react";
import { AppDataProvider } from "@/app/AppDataProvider";
import { AuthContext } from "@/features/auth/auth-context";
import { MemberDirectory } from "@/features/community/members/MemberDirectory";
import { CommunityMembers } from "@/features/community/components/CommunityMembers";
import { queryKeys } from "@/features/community/api/hooks";
import { channelFixture, communityFixture, memberPageFixture, profileFixture } from "@/test/api-fixtures";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";

vi.mock("@/lib/env", () => ({ apiConfiguration: { url: "/api/v1", configured: true, error: null } }));
afterEach(() => vi.unstubAllGlobals());
function CaptureQueries({ capture }: { capture: (client: QueryClient) => void }) {
  const queries = useQueryClient();
  useEffect(() => capture(queries), [capture, queries]);
  return null;
}
function setup(children: ReactNode = <MemberDirectory communityId={communityFixture.id} channelId={channelFixture.id} />,
  handler?: (url: string, options?: RequestInit) => Promise<Response>) {
  let queries!: QueryClient;
  const request = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(handler ?? (async (url) =>
    Response.json({ ...memberPageFixture, channel_id: url.includes("/channels/") ? channelFixture.id : null })));
  vi.stubGlobal("fetch", request);
  const provider = (content: ReactNode) => <AuthContext.Provider value={{ ...signedOutState, session: sessionFixture }}>
    <AppDataProvider><CaptureQueries capture={(client) => { queries = client; }} />{content}</AppDataProvider>
  </AuthContext.Provider>;
  const result = render(provider(children));
  return { request, get queries() { return queries; }, rerender: (content: ReactNode) => result.rerender(provider(content)) };
}

describe("member directories", () => {
  it("loads clean channel-visible profiles and retains roles in the profile card without IDs or presence guesses", async () => {
    vi.stubGlobal("Image", vi.fn(function () {
      const image = document.createElement("img");
      Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 64 } });
      return image;
    }));
    const { request } = setup(undefined, async () => Response.json({ ...memberPageFixture,
      items: [{ ...memberPageFixture.items[0], username: "u_e8d4720993964d8e9559cc1a054bb8", avatar_url: "https://cdn.example.com/member.png" }] }));
    const trigger = await screen.findByRole("button", { name: `View profile for ${profileFixture.display_name}` });
    await waitFor(() => expect(document.querySelector('img[src="https://cdn.example.com/member.png"]')).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Members — 1" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh members" })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/loaded|online|offline|u_e8d472|11111111/);
    expect(request.mock.calls[0]![0]).toBe(`/api/v1/communities/${communityFixture.id}/channels/${channelFixture.id}/members?search=&limit=50`);
    expect(request.mock.calls[0]![1]).toMatchObject({ credentials: "include", signal: expect.any(AbortSignal) });
    fireEvent.click(trigger);
    const card = screen.getByRole("dialog", { name: profileFixture.display_name });
    expect(card).not.toHaveAttribute("aria-modal", "true");
    expect(document.querySelector(".dialog-overlay")).toBeNull();
    expect(within(card).queryByText(profileFixture.id)).not.toBeInTheDocument();
    expect(within(card).queryByText(/u_e8d472/)).not.toBeInTheDocument();
    expect(within(card).getByText("Joined community")).toBeInTheDocument();
    expect(within(card).getByText("Member")).toBeInTheDocument();
    fireEvent.keyDown(card, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("shows loading and empty states", async () => {
    let finish!: (response: Response) => void;
    setup(undefined, () => new Promise<Response>((resolve) => { finish = resolve; }));
    expect(screen.getByRole("status", { name: /^Loading members/ })).toBeInTheDocument();
    await act(async () => { finish(Response.json({ ...memberPageFixture, items: [], total: 0 })); });
    expect(await screen.findByRole("heading", { name: "No members to show" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Members — 0" })).toBeInTheDocument();
  });
  it("paginates using the exact cursor and shows the backend total rather than loaded count", async () => {
    const { request } = setup(undefined, async (url) => Response.json(url.includes("after_id=")
      ? { ...memberPageFixture, total: 2, items: [{ ...memberPageFixture.items[0],
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", display_name: "Second Core Member", username: "second_member", roles: [] }] }
      : { ...memberPageFixture, total: 2, next_cursor: profileFixture.id }));
    fireEvent.click(await screen.findByRole("button", { name: "Load more members" }));
    await screen.findByText("Second Core Member");
    expect(screen.getByText(profileFixture.display_name)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Members — 2" })).toBeInTheDocument();
    expect(request.mock.calls.at(-1)![0]).toContain(`after_id=${profileFixture.id}`);
    expect(screen.queryByRole("button", { name: "Load more members" })).not.toBeInTheDocument();
  });
  it("drops cached private rows after a failed background revalidation and supports retry", async () => {
    const { request, queries } = setup();
    await screen.findByText(profileFixture.display_name);
    request.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await act(async () => { await queries.invalidateQueries({ queryKey: queryKeys.members(communityFixture.id) }); });
    expect(await screen.findByRole("alert")).toHaveTextContent("don't have permission");
    expect(screen.queryByText(profileFixture.display_name)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(profileFixture.display_name)).toBeInTheDocument();
  });
  it("cancels old channel/community loads and ignores a late response after navigation", async () => {
    const { request, queries, rerender } = setup();
    await screen.findByText(profileFixture.display_name);
    let finish!: (response: Response) => void;
    request.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    await act(async () => { void queries.invalidateQueries({ queryKey: queryKeys.members(communityFixture.id) }); });
    await waitFor(() => expect(finish).toBeDefined());
    const signal = request.mock.calls.at(-1)![1]!.signal as AbortSignal;
    const nextCommunity = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const nextChannel = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    request.mockResolvedValueOnce(Response.json({ ...memberPageFixture, community_id: nextCommunity, channel_id: nextChannel, items: [], total: 0 }));
    rerender(<MemberDirectory communityId={nextCommunity} channelId={nextChannel} />);
    expect(signal.aborted).toBe(true);
    await screen.findByText("No members to show");
    await act(async () => { finish(Response.json(memberPageFixture)); });
    expect(screen.queryByText(profileFixture.display_name)).not.toBeInTheDocument();
  });
  it("retains the member directory without user-reference admission", async () => {
    const { request } = setup(<CommunityMembers community={communityFixture} profile={profileFixture} />);
    await screen.findByText(profileFixture.display_name);
    expect(screen.queryByRole("form", { name: "Add community member" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Member reference")).not.toBeInTheDocument();
    expect(request.mock.calls.every(([, options]) => options?.method === "GET")).toBe(true);
  });
});
