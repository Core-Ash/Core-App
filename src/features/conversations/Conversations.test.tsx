import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataContext } from "@/app/app-data-context";
import {
  parseConversationDetail,
  parseConversationSummary,
} from "@/lib/api/contracts";
import { createApiClient } from "@/lib/api/client";
import { profileFixture } from "@/test/api-fixtures";
import { CreateGroupDmDialog } from "@/features/conversations/components/CreateGroupDmDialog";
import { ConversationHeader } from "@/features/conversations/components/ConversationHeader";
import { GroupMemberList } from "@/features/conversations/components/GroupMemberList";
import type { ConversationDetail } from "@/lib/api/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const userA = {
  ...profileFixture,
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  username: "Ash",
  display_name: "Ashley",
  discriminator: "0007",
};

const userB = {
  ...profileFixture,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  username: "Dragon",
  display_name: "Dragon Slayer",
  discriminator: "0024",
};

const userC = {
  ...profileFixture,
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  username: "Player",
  display_name: "Player One",
  discriminator: "1024",
};

describe("conversations contracts and parsers", () => {
  it("parses valid direct conversation summary and details", () => {
    const rawSummary = {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      type: "direct",
      name: null,
      icon_url: null,
      created_by: userA.id,
      created_at: "2026-11-17T12:00:00Z",
      updated_at: "2026-11-17T12:00:00Z",
      last_message_at: "2026-11-17T12:05:00Z",
      role: "member",
      hidden: false,
      members: [
        {
          id: userA.id,
          role: "member",
          joined_at: "2026-11-17T12:00:00Z",
          profile: userA,
        },
        {
          id: userB.id,
          role: "member",
          joined_at: "2026-11-17T12:00:00Z",
          profile: userB,
        },
      ],
      last_message: {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        author_id: userB.id,
        body: "Hey there!",
        created_at: "2026-11-17T12:05:00Z",
        client_nonce: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      },
    };

    const parsed = parseConversationSummary(rawSummary);
    expect(parsed.id).toBe(rawSummary.id);
    expect(parsed.type).toBe("direct");
    expect(parsed.members).toHaveLength(2);
    expect(parsed.last_message?.body).toBe("Hey there!");
  });

  it("parses valid group conversation and rejects invalid types", () => {
    const rawDetail = {
      id: "11111111-1111-4111-8111-111111111111",
      type: "group",
      name: "Gaming Squad",
      icon_url: null,
      created_by: userA.id,
      created_at: "2026-11-17T12:00:00Z",
      updated_at: "2026-11-17T12:00:00Z",
      last_message_at: "2026-11-17T12:00:00Z",
      role: "owner",
      members: [
        {
          id: userA.id,
          role: "owner",
          joined_at: "2026-11-17T12:00:00Z",
          profile: userA,
        },
        {
          id: userB.id,
          role: "member",
          joined_at: "2026-11-17T12:00:00Z",
          profile: userB,
        },
        {
          id: userC.id,
          role: "member",
          joined_at: "2026-11-17T12:00:00Z",
          profile: userC,
        },
      ],
    };

    const detail = parseConversationDetail(rawDetail);
    expect(detail.name).toBe("Gaming Squad");
    expect(detail.role).toBe("owner");
    expect(detail.members).toHaveLength(3);

    expect(() =>
      parseConversationDetail({ ...rawDetail, type: "server_channel" }),
    ).toThrow();
  });
});

describe("CreateGroupDmDialog", () => {
  function setupDialog() {
    const fetcher = vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      if (path === "/bootstrap") return Response.json({ profile: profileFixture, communities: { items: [] } });
      if (path === "/friends") {
        return Response.json({
          items: [userB, userC],
          next_cursor: null,
        });
      }
      return Response.json({});
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
          <MemoryRouter>
            <CreateGroupDmDialog open={true} onOpenChange={vi.fn()} />
          </MemoryRouter>
        </AppDataContext.Provider>
      </QueryClientProvider>,
    );

    return { fetcher };
  }

  it("lists friends, toggles selection, and enforces participant limits", async () => {
    setupDialog();

    expect(await screen.findByText("Dragon Slayer")).toBeInTheDocument();
    expect(screen.getByText("Player One")).toBeInTheDocument();
    expect(screen.getByText("Selected: 0/8")).toBeInTheDocument();

    // Select Dragon
    fireEvent.click(screen.getByText("Dragon Slayer"));
    expect(screen.getByText("Selected: 1/8")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Group DM" })).toBeEnabled();

    // Select Player (now 2, button switches to Group DM)
    fireEvent.click(screen.getByText("Player One"));
    expect(screen.getByText("Selected: 2/8")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Group DM" }),
    ).toBeEnabled();
  });
});

describe("ConversationHeader and GroupMemberList", () => {
  const groupConv: ConversationDetail = {
    id: "11111111-1111-4111-8111-111111111111",
    type: "group",
    name: "Co-op Crew",
    icon_url: null,
    created_by: userA.id,
    created_at: "2026-11-17T12:00:00Z",
    updated_at: "2026-11-17T12:00:00Z",
    last_message_at: "2026-11-17T12:00:00Z",
    role: "owner",
    members: [
      {
        id: userA.id,
        role: "owner",
        joined_at: "2026-11-17T12:00:00Z",
        profile: userA,
      },
      {
        id: userB.id,
        role: "member",
        joined_at: "2026-11-17T12:00:00Z",
        profile: userB,
      },
    ],
  };

  it("renders group header with editable name and member count", () => {
    const api = createApiClient({
      baseUrl: "https://core.test",
      sessionSignal: () => new AbortController().signal,
      onUnauthorized: async () => "active",
    });
    const queries = new QueryClient();

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
          <MemoryRouter>
            <ConversationHeader
              conversation={groupConv}
              currentUserId={userA.id}
              membersVisible={true}
              onToggleMembers={vi.fn()}
              search=""
              onSearch={vi.fn()}
            />
          </MemoryRouter>
        </AppDataContext.Provider>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Co-op Crew")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Members" })).toBeInTheDocument();
  });

  it("renders member list with owner indicator and owner controls", () => {
    const api = createApiClient({
      baseUrl: "https://core.test",
      sessionSignal: () => new AbortController().signal,
      onUnauthorized: async () => "active",
    });
    const queries = new QueryClient();

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
          <MemoryRouter>
            <GroupMemberList
              conversationId={groupConv.id}
              members={groupConv.members}
              currentUserId={userA.id}
              currentUserRole="owner"
            />
          </MemoryRouter>
        </AppDataContext.Provider>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Members — 2")).toBeInTheDocument();
    expect(screen.getByText("Ashley")).toBeInTheDocument();
    expect(screen.getByText("Dragon Slayer")).toBeInTheDocument();
    // Owner can remove other members
    expect(
      screen.getByRole("button", { name: "Remove Dragon Slayer" }),
    ).toBeInTheDocument();
    // Owner cannot remove self
    expect(
      screen.queryByRole("button", { name: "Remove Ashley" }),
    ).not.toBeInTheDocument();
  });
});
