import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataProvider } from "@/app/AppDataProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthContext } from "@/features/auth/auth-context";
import { CommunityPage } from "@/features/community/CommunityPage";
import { FriendsPage } from "@/features/friends/FriendsPage";
import {
  channelFixture,
  communityFixture,
  memberPageFixture,
  messageFixture,
  profileFixture,
} from "@/test/api-fixtures";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";

vi.mock("@/lib/env", () => ({
  apiConfiguration: { url: "/api/v1", configured: true, error: null },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const blockedFriend = {
  ...profileFixture,
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  username: "Rival",
  display_name: "Rival Player",
  discriminator: "4455",
};

function setup(initialPath = `/app?community=${communityFixture.id}&channel=${channelFixture.id}`) {
  let currentProfile = {
    ...profileFixture,
    username: "Ash",
    display_name: "Ash",
    discriminator: "2662",
  };
  let blocked = [blockedFriend];

  const request = vi.fn(async (input: string, options: RequestInit = {}) => {
    const url = new URL(input, "https://core.example.com");
    if (url.pathname.endsWith("/event-permissions"))
      return Response.json({ create: true, manage: true });
    if (url.pathname.endsWith("/invite-permissions"))
      return Response.json({ create: true, manage: true, manage_channels: true, owner: true });
    if (url.pathname === "/api/v1/bootstrap")
      return Response.json({
        profile: currentProfile,
        communities: { items: [communityFixture] },
      });
    if (url.pathname === "/api/v1/me/username" && options.method === "PATCH") {
      const payload = JSON.parse(String(options.body)) as { username: string };
      currentProfile = { ...currentProfile, username: payload.username };
      return Response.json(currentProfile);
    }
    if (url.pathname === `/api/v1/communities/${communityFixture.id}/channels`)
      return Response.json({ items: [channelFixture] });
    if (url.pathname.endsWith("/members"))
      return Response.json({ ...memberPageFixture, channel_id: channelFixture.id });
    if (/^\/api\/v1\/channels\/[^/]+\/messages$/.test(url.pathname))
      return Response.json({ items: [messageFixture], next_cursor: null });
    if (url.pathname === "/api/v1/friends/summary")
      return Response.json({
        friends: 0,
        incoming: 0,
        outgoing: 0,
        blocked: blocked.length,
      });
    if (url.pathname === "/api/v1/users/blocked")
      return Response.json({ items: blocked, next_cursor: null });
    if (url.pathname === `/api/v1/users/${blockedFriend.id}/block` && options.method === "DELETE") {
      blocked = [];
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fixture route: ${url.pathname}`);
  });

  vi.stubGlobal("fetch", request);

  render(
    <AuthContext.Provider value={{ ...signedOutState, session: sessionFixture }}>
      <AppDataProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/app" element={<CommunityPage />} />
              <Route path="/app/communities" element={<CommunityPage />} />
              <Route path="/app/friends" element={<FriendsPage />} />
              <Route path="/app/settings" element={<CommunityPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppDataProvider>
    </AuthContext.Provider>,
  );

  return { request };
}

describe("Discord-style Settings modal overlay", () => {
  it("opens over the active channel, preserves underlying chat state and scroll position, and restores focus on close", async () => {
    const { request } = setup();
    expect(await screen.findByText(messageFixture.body!)).toBeInTheDocument();

    const messageScroll = screen.getByRole("region", { name: "general message history" });
    Object.defineProperty(messageScroll, "scrollTop", { value: 180, writable: true });

    const draft = screen.getByRole("textbox", { name: "Message #general" });
    fireEvent.change(draft, { target: { value: "Draft kept while in settings" } });

    const trigger = screen.getByRole("button", { name: "Account settings" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "User Settings" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "My Account" })).toBeInTheDocument();
    expect(within(dialog).getAllByText("Ash#2662").length).toBeGreaterThan(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Close settings" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "User Settings" })).not.toBeInTheDocument(),
    );

    expect(screen.getByRole("textbox", { name: "Message #general" })).toHaveValue(
      "Draft kept while in settings",
    );
    expect(messageScroll.scrollTop).toBe(180);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(request.mock.calls.filter(([url]) => url === "/api/v1/bootstrap")).toHaveLength(1);
  });

  it("edits the username inline, warns on unsaved changes, and preserves the 4-digit discriminator", async () => {
    const { request } = setup();
    await screen.findByText(messageFixture.body!);

    fireEvent.click(screen.getByRole("button", { name: "Account settings" }));
    const dialog = await screen.findByRole("dialog", { name: "User Settings" });

    expect(within(dialog).queryByLabelText("Change username")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Edit" }));
    const input = within(dialog).getByLabelText("Change username");
    fireEvent.change(input, { target: { value: "ShadowAsh" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Close settings" }));
    expect(within(dialog).getByRole("alertdialog", { name: "Unsaved changes" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Keep Editing" }));
    expect(within(dialog).queryByRole("alertdialog", { name: "Unsaved changes" })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Save username" }));
    await waitFor(() =>
      expect(within(dialog).queryByLabelText("Change username")).not.toBeInTheDocument(),
    );

    expect(within(dialog).getAllByText("ShadowAsh#2662").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("#2662")).toBeInTheDocument();
    expect(
      request.mock.calls.find(([, init]) => init?.method === "PATCH")?.[1]?.body,
    ).toBe('{"username":"ShadowAsh"}');
  });

  it("navigates categories smoothly, filters sidebar items, and manages blocked users in Privacy & Safety", async () => {
    const { request } = setup();
    await screen.findByText(messageFixture.body!);

    fireEvent.click(screen.getByRole("button", { name: "Account settings" }));
    const dialog = await screen.findByRole("dialog", { name: "User Settings" });

    const searchInput = within(dialog).getByRole("searchbox", { name: "Search settings" });
    fireEvent.change(searchInput, { target: { value: "voice" } });
    expect(within(dialog).getByRole("button", { name: "Voice & Audio" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "My Account" })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear settings search" }));
    expect(within(dialog).getByRole("button", { name: "My Account" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Privacy & Safety" }));
    expect(within(dialog).getByRole("heading", { name: "Privacy & Safety" })).toBeInTheDocument();
    expect(await within(dialog).findByText("Rival Player")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Unblock" }));
    await waitFor(() =>
      expect(within(dialog).getByText("You haven’t blocked anyone.")).toBeInTheDocument(),
    );
    expect(
      request.mock.calls.some(
        ([url, init]) => url.endsWith(`/users/${blockedFriend.id}/block`) && init?.method === "DELETE",
      ),
    ).toBe(true);
  });

  it("applies Appearance & Accessibility preferences to the document and cleans up microphone tests on close", async () => {
    const stopTrack = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: "audioinput", deviceId: "mic-1", label: "Studio USB Mic" },
          { kind: "audiooutput", deviceId: "spk-1", label: "Studio Headphones" },
        ]),
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    setup();
    await screen.findByText(messageFixture.body!);

    fireEvent.click(screen.getByRole("button", { name: "Account settings" }));
    const dialog = await screen.findByRole("dialog", { name: "User Settings" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Appearance" }));
    fireEvent.click(within(dialog).getByRole("radio", { name: /Compact/i }));
    expect(document.documentElement.dataset.messageDisplay).toBe("compact");

    fireEvent.click(within(dialog).getByRole("button", { name: "Accessibility" }));
    fireEvent.click(within(dialog).getByRole("radio", { name: /Reduce motion/i }));
    expect(document.documentElement.dataset.motion).toBe("reduce");

    fireEvent.click(within(dialog).getByRole("button", { name: "Voice & Audio" }));
    expect(await within(dialog).findByRole("option", { name: "Studio USB Mic" })).toBeInTheDocument();
    expect(within(dialog).getByText("Audio Processing")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Let's Check" }));
    expect(await within(dialog).findByRole("button", { name: "Stop Testing" })).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "User Settings" })).not.toBeInTheDocument(),
    );
    expect(stopTrack).toHaveBeenCalled();
  });
});
