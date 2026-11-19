import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServerSettingsLayout } from "./ServerSettingsLayout";
import { AppDataContext } from "@/app/app-data-context";
import type { ApiClient } from "@/lib/api/client";
import type { Community, Profile } from "@/lib/api/types";

const mockCommunity: Community = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Sand kneeguards",
  owner_id: "11111111-1111-4111-8111-111111111111",
};

const mockProfile: Profile = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "commander",
  discriminator: "0001",
  display_name: "Commander",
  email: "commander@example.com",
  avatar_url: null,
};

const mockSettings = {
  id: mockCommunity.id,
  name: mockCommunity.name,
  owner_id: mockProfile.id,
  description: "A great community for gamers",
  icon_url: null,
  banner_url: "linear-gradient(135deg, #f04450, #990011)",
  highlights: ["🎮", "🔥", "⚡"],
  tag: "SAND",
  tag_color: "#f04450",
  tag_badge: "⚔️",
  tag_enabled: true,
  community_enabled: true,
  rules_channel_id: null,
  announcement_channel_id: null,
  safety_verification_level: "low",
  safety_spam_protection: true,
  safety_mention_limit: 5,
  member_count: 54,
  created_at: "2025-04-12T10:00:00Z",
  permissions: {
    owner: true,
    manage_community: true,
    manage_roles: true,
    manage_members: true,
    manage_bans: true,
    manage_invites: true,
    view_audit_log: true,
    manage_emojis: true,
  },
};

function renderSettings(props: {
  isOwner?: boolean;
  canManage?: boolean;
  onClose?: () => void;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const apiMock = {
    get: vi.fn((path: string) => {
      if (path.includes("/settings")) return Promise.resolve(mockSettings);
      if (path.includes("/roles")) return Promise.resolve({ items: [
        { id: "r1", name: "Admin", color: "#f04450", position: 10, member_count: 2, permissions: ["community.manage", "roles.manage"] },
        { id: "r2", name: "Member", color: "#99aab5", position: 0, member_count: 52, permissions: ["channels.view", "messages.send"] },
      ]});
      if (path.includes("/members")) return Promise.resolve({ items: [
        { id: mockProfile.id, username: mockProfile.username, display_name: mockProfile.display_name, avatar_url: null, joined_at: "2025-04-12T10:00:00Z", roles: [] },
        { id: "u2", username: "scout", display_name: "Scout User", avatar_url: null, joined_at: "2025-04-13T10:00:00Z", roles: [{ id: "r2", name: "Member", color: "#99aab5", position: 0 }] },
      ], total: 2 });
      if (path.includes("/bans")) return Promise.resolve({ items: [
        { user_id: "b1", username: "spammer", display_name: "Spam Bot", avatar_url: null, reason: "Spamming links", created_at: "2025-04-14T10:00:00Z", banned_by: mockProfile.id, banned_by_name: "Commander" },
      ]});
      if (path.includes("/audit-logs")) return Promise.resolve({ items: [
        { id: "a1", action_type: "community_settings_updated", target_id: mockCommunity.id, target_type: "community", changes: { name: "Sand kneeguards" }, created_at: "2025-04-14T12:00:00Z", actor: { id: mockProfile.id, username: mockProfile.username, display_name: mockProfile.display_name, avatar_url: null } },
      ]});
      if (path.includes("/automod/rules")) return Promise.resolve({ items: [
        { id: "am1", name: "Block toxic words", enabled: true, trigger_type: "keyword", trigger_metadata: { keywords: ["badword", "scam"] }, actions: ["block_message"], created_at: "2025-04-14T12:00:00Z" },
      ]});
      if (path.includes("/emojis")) return Promise.resolve({ items: [
        { id: "e1", name: "core_hype", url: "https://example.com/hype.png", created_at: "2025-04-14T12:00:00Z" },
      ]});
      if (path.includes("/stickers")) return Promise.resolve({ items: [] });
      if (path.includes("/soundboard")) return Promise.resolve({ items: [] });
      if (path.includes("/onboarding")) return Promise.resolve({ enabled: false, welcome_message: null, default_channels: [], rules: null });
      if (path.includes("/templates")) return Promise.resolve({ items: [] });
      if (path.includes("/tag-preference")) return Promise.resolve({ display_tag: true });
      if (path.includes("/channels")) return Promise.resolve({ items: [{ id: "c1", name: "general", topic: "", position: 0 }] });
      return Promise.resolve({ items: [] });
    }),
    patch: vi.fn(() => Promise.resolve({ ...mockSettings })),
    post: vi.fn(() => Promise.resolve({ id: "new-id" })),
    put: vi.fn(() => Promise.resolve({ display_tag: true })),
    delete: vi.fn(() => Promise.resolve()),
  };

  const closeFn = props.onClose ?? vi.fn();

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <AppDataContext.Provider
        value={{
          api: apiMock as unknown as ApiClient,
          ready: true,
          configured: true,
          configurationError: null,
          clearPrivateData: vi.fn(),
        }}
      >
        <ServerSettingsLayout
          community={mockCommunity}
          profile={props.isOwner === false ? { ...mockProfile, id: "other-user" } : mockProfile}
          onClose={closeFn}
        />
      </AppDataContext.Provider>
    </QueryClientProvider>
  );

  return { ...rendered, apiMock, closeFn };
}

describe("ServerSettingsLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders server profile with Discord-style sections and live preview card", async () => {
    const { getByText } = renderSettings();

    // Check header
    expect(await screen.findByRole("heading", { level: 1, name: "Sand kneeguards" })).toBeInTheDocument();

    // Check navigation items from Discord groups
    expect(screen.getByRole("link", { name: "Server Profile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Server Tag" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Onboarding" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Boost Perks" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Emojis" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stickers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Soundboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Members" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Roles" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Invites" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Access" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Integrations" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "App Directory" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Safety Setup" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit Log" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bans" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AutoMod" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Community Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Server Template" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Delete Server" })).toBeInTheDocument();

    // Check preview card
    expect(getByText("Preview")).toBeInTheDocument();
    expect(await screen.findByText("54 members")).toBeInTheDocument();
  });

  it("modifies server name and displays unsaved changes bar with Reset and Save", async () => {
    const { apiMock } = renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Sand kneeguards")).toBeInTheDocument();
    });

    const input = screen.getByDisplayValue("Sand kneeguards");
    fireEvent.change(input, { target: { value: "Sand kneeguards Pro" } });

    // Unsaved changes bar should appear
    expect(screen.getByText("Careful — you have unsaved changes!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();

    // Click Save Changes
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => {
      expect(apiMock.patch).toHaveBeenCalledWith(
        `/communities/${mockCommunity.id}/settings`,
        expect.objectContaining({ name: "Sand kneeguards Pro" })
      );
    });
  });

  it("navigates smoothly across settings pages and closes on ESC or close button", async () => {
    const { closeFn } = renderSettings();

    // Navigate to Server Tag
    fireEvent.click(screen.getByRole("link", { name: "Server Tag" }));
    expect(await screen.findByText("Enable Server Tag")).toBeInTheDocument();

    // Navigate to Roles
    fireEvent.click(screen.getByRole("link", { name: "Roles" }));
    expect(await screen.findByText("Create Role")).toBeInTheDocument();

    // Navigate to Bans
    fireEvent.click(screen.getByRole("link", { name: "Bans" }));
    expect(await screen.findByText("Server Bans")).toBeInTheDocument();

    // Click Close Button
    const closeBtn = screen.getByRole("link", { name: "Back to channels" });
    fireEvent.click(closeBtn);
    expect(closeFn).toHaveBeenCalled();
  });

  it("protects non-owners from deleting the server", async () => {
    renderSettings({ isOwner: false });

    // Navigate to Delete Server
    fireEvent.click(screen.getByRole("link", { name: "Delete Server" }));
    expect(await screen.findByText("Only the server owner can permanently delete this server.")).toBeInTheDocument();
  });

  it("allows assigning and removing member roles via Discord-style quick role popover", async () => {
    const { apiMock } = renderSettings({ isOwner: true });

    // Navigate to Members
    fireEvent.click(screen.getByRole("link", { name: "Members" }));
    expect(await screen.findByText("Scout User")).toBeInTheDocument();

    // Click quick role assign "+" button for Scout User
    const assignBtn = screen.getByRole("button", { name: "Assign roles to Scout User" });
    fireEvent.click(assignBtn);

    // Popover opens with search and roles list
    expect(await screen.findByPlaceholderText("Search roles")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();

    // Toggle Admin role
    const adminCheckbox = screen.getByRole("menuitemcheckbox", { name: /Admin/i });
    expect(adminCheckbox).toHaveAttribute("aria-checked", "false");
    fireEvent.click(adminCheckbox);

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith(
        `/communities/${mockCommunity.id}/roles/r1/members/u2`,
        {}
      );
    });
  });
});
