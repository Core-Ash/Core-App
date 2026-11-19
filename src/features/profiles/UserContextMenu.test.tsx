import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataContext } from "@/app/app-data-context";
import { createApiClient } from "@/lib/api/client";
import { profileFixture } from "@/test/api-fixtures";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import { ChatMessage } from "@/features/community/components/ChatMessage";
import type { ChatMessageData } from "@/features/community/types";

const otherUser = {
  ...profileFixture,
  id: "22222222-2222-4222-8222-222222222222",
  username: "Dragon",
  display_name: "Dragon Slayer",
  discriminator: "0024",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup(element: React.ReactNode) {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const fetcher = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/relationship")) return Response.json({ state: "friends", request_id: null });
    if (path === "/bootstrap") return Response.json({ profile: profileFixture, communities: { items: [] } });
    return new Response(null, { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);

  const api = createApiClient({
    baseUrl: "https://core.test",
    sessionSignal: () => new AbortController().signal,
    onUnauthorized: async () => "active",
  });
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queries.setQueryData(["profile"], profileFixture);

  render(
    <QueryClientProvider client={queries}>
      <AppDataContext.Provider
        value={{
          api,
          ready: true,
          configured: true,
          configurationError: null,
          clearPrivateData: vi.fn(),
        }}
      >
        <MemoryRouter>{element}</MemoryRouter>
      </AppDataContext.Provider>
    </QueryClientProvider>,
  );
  return { fetcher };
}

describe("UserContextMenu", () => {
  it("opens context menu on right-click from MemberIdentity", async () => {
    setup(<MemberIdentity profile={otherUser} />);

    const button = screen.getByRole("button", { name: "View profile for Dragon Slayer" });
    fireEvent.contextMenu(button, { clientX: 100, clientY: 100 });

    const menu = await screen.findByRole("menu", { name: "User menu for Dragon Slayer" });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Message" })).toBeInTheDocument();
    expect(await screen.findByRole("menuitem", { name: "Remove Friend" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Block User" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy Username" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy User ID" })).toBeInTheDocument();

    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("opens context menu on right-click on avatar in ChatMessage", async () => {
    const msg: ChatMessageData = {
      id: "msg-1",
      body: "Hello from channel",
      createdAt: "2026-11-19T14:00:00Z",
      edited: false,
      deleted: false,
      author: {
        id: otherUser.id,
        name: otherUser.display_name,
        initials: "DS",
        tone: "slate",
        profile: otherUser,
      },
    };

    setup(<ChatMessage message={msg} grouped={false} />);

    const buttons = screen.getAllByRole("button", { name: "View profile for Dragon Slayer" });
    const avatarBtn = buttons[0]!;
    fireEvent.contextMenu(avatarBtn, { clientX: 200, clientY: 200 });

    const menu = await screen.findByRole("menu", { name: "User menu for Dragon Slayer" });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Message" })).toBeInTheDocument();
  });
});
