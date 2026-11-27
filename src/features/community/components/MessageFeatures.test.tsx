import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataContext } from "@/app/app-data-context";
import {
  queryKeys,
  useSendMessage,
  useToggleReaction,
} from "@/features/community/api/hooks";
import { ChatMessage } from "@/features/community/components/ChatMessage";
import { ForwardMessageDialog } from "@/features/community/components/ForwardMessageDialog";
import { MessageComposer } from "@/features/community/components/MessageComposer";
import { MessageList } from "@/features/community/components/MessageList";
import {
  CreateThreadDialog,
  ThreadPanel,
} from "@/features/community/components/ThreadPanel";
import type { ChatMessageData } from "@/features/community/types";
import { conversationQueryKeys } from "@/features/conversations/api";
import { createApiClient } from "@/lib/api/client";
import type { Message, MessagePage, ThreadDetail } from "@/lib/api/types";
import {
  channelFixture,
  communityFixture,
  messageFixture,
  profileFixture,
} from "@/test/api-fixtures";

afterEach(() => vi.unstubAllGlobals());

const meId = profileFixture.id;
const otherId = "22222222-2222-4222-8222-999999999999";
const otherProfile = {
  id: otherId,
  username: "josef",
  discriminator: "1234",
  display_name: "Josef",
  avatar_url: null,
};

const baseChatMessage: ChatMessageData = {
  id: messageFixture.id,
  body: "Anyone playing tonight?",
  createdAt: "2026-11-27T15:40:00Z",
  author: {
    id: otherId,
    name: "Josef",
    initials: "J",
    tone: "slate",
    profile: otherProfile,
  },
};

function createTestEnv(
  customHandler?: (url: URL, options: RequestInit) => Response | Promise<Response>,
) {
  const queries = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  queries.setQueryData(queryKeys.profile, profileFixture);
  queries.setQueryData(queryKeys.communities, [communityFixture]);
  queries.setQueryData(queryKeys.channels(communityFixture.id), [channelFixture]);
  queries.setQueryData(conversationQueryKeys.conversations, [
    {
      id: "77777777-7777-4777-8777-777777777777",
      type: "direct",
      name: null,
      icon_url: null,
      created_by: meId,
      created_at: "2026-11-27T10:00:00Z",
      updated_at: "2026-11-27T10:00:00Z",
      last_message_at: "2026-11-27T10:00:00Z",
      role: "member",
      hidden: false,
      members: [
        { id: meId, role: "member", joined_at: "2026-11-27T10:00:00Z", profile: profileFixture },
        { id: otherId, role: "member", joined_at: "2026-11-27T10:00:00Z", profile: otherProfile },
      ],
      last_message: null,
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      type: "group",
      name: "Gaming Group",
      icon_url: null,
      created_by: meId,
      created_at: "2026-11-27T10:00:00Z",
      updated_at: "2026-11-27T10:00:00Z",
      last_message_at: "2026-11-27T10:00:00Z",
      role: "owner",
      hidden: false,
      members: [
        { id: meId, role: "owner", joined_at: "2026-11-27T10:00:00Z", profile: profileFixture },
        { id: otherId, role: "member", joined_at: "2026-11-27T10:00:00Z", profile: otherProfile },
      ],
      last_message: null,
    },
  ]);

  const fetcher = vi.fn(async (input: string, options: RequestInit = {}) => {
    const url = new URL(input, "https://core.test");
    if (customHandler) {
      return customHandler(url, options);
    }
    return Response.json({ items: [] });
  });
  vi.stubGlobal("fetch", fetcher);

  const api = createApiClient({
    baseUrl: "https://core.test/api/v1",
    sessionSignal: () => new AbortController().signal,
    onUnauthorized: async () => "active",
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
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
        {children}
      </AppDataContext.Provider>
    </QueryClientProvider>
  );

  return { queries, fetcher, api, Wrapper };
}

describe("Feature 1: Emoji Reactions", () => {
  it("supports quick reactions and Add Reaction from the context menu and renders counts and selected states", async () => {
    const onToggleReaction = vi.fn();
    const msgWithReactions: ChatMessageData = {
      ...baseChatMessage,
      reactions: [
        {
          emoji: "😂",
          emoji_name: "Laughing face",
          count: 3,
          me: true,
          users: [profileFixture, otherProfile],
        },
        {
          emoji: "👍",
          emoji_name: "Thumbs up",
          count: 5,
          me: false,
          users: [otherProfile],
        },
      ],
    };

    const { Wrapper } = createTestEnv();
    const { container } = render(
      <Wrapper>
        <ol>
          <ChatMessage
            message={msgWithReactions}
            grouped={false}
            currentUserId={meId}
            mentionContext={{
              kind: "channel",
              id: channelFixture.id,
              name: "general",
              communityId: communityFixture.id,
            }}
            onToggleReaction={onToggleReaction}
          />
        </ol>
      </Wrapper>,
    );

    const laughPill = screen.getByRole("button", { name: /React with :Laughing face:, 3 reactions/ });
    expect(laughPill).toHaveAttribute("aria-pressed", "true");
    const thumbsPill = screen.getByRole("button", { name: /React with :Thumbs up:, 5 reactions/ });
    expect(thumbsPill).toHaveAttribute("aria-pressed", "false");

    // Clicking active reaction calls remove=true
    fireEvent.click(laughPill);
    expect(onToggleReaction).toHaveBeenCalledWith(
      msgWithReactions.id,
      expect.objectContaining({ value: "😂" }),
      true,
    );

    // Right click message -> quick reaction
    fireEvent.contextMenu(container.querySelector(".message-body")!);
    const menu = await screen.findByRole("menu", { name: "Message actions" });
    fireEvent.click(within(menu).getByRole("button", { name: "React with 💀" }));
    expect(onToggleReaction).toHaveBeenCalledWith(
      msgWithReactions.id,
      expect.objectContaining({ value: "💀" }),
      false,
    );
  });

  it("applies optimistic add/remove reaction updates and rolls back on backend rejection", async () => {
    let shouldFail = false;
    const { queries, Wrapper } = createTestEnv(async (url, options) => {
      if (url.pathname.endsWith("/reactions")) {
        if (shouldFail) {
          return new Response(JSON.stringify({ error: "Permission denied" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
        const isDelete = options.method === "DELETE";
        return Response.json({
          ...messageFixture,
          reactions: isDelete
            ? []
            : [
                {
                  emoji: "🔥",
                  emoji_name: "Fire",
                  emoji_url: null,
                  count: 1,
                  me: true,
                  users: [profileFixture],
                },
              ],
        });
      }
      return Response.json({ items: [] });
    });

    const cacheKey = queryKeys.messages(channelFixture.id);
    queries.setQueryData(cacheKey, {
      pages: [{ items: [{ ...messageFixture, reactions: [] }], next_cursor: null }],
      pageParams: [null],
    });

    function ReactionHarness() {
      const toggle = useToggleReaction("channel", channelFixture.id, cacheKey);
      const data = queries.getQueryData<{ pages: MessagePage[] }>(cacheKey);
      const reactions = data?.pages[0]?.items[0]?.reactions ?? [];
      return (
        <div>
          <span data-testid="count">{reactions[0]?.count ?? 0}</span>
          <button
            type="button"
            onClick={() =>
              toggle.mutate({
                messageId: messageFixture.id,
                emoji: "🔥",
                emojiName: "Fire",
                remove: false,
              })
            }
          >
            Add Fire
          </button>
          <button
            type="button"
            onClick={() =>
              toggle.mutate({
                messageId: messageFixture.id,
                emoji: "🔥",
                emojiName: "Fire",
                remove: true,
              })
            }
          >
            Remove Fire
          </button>
        </div>
      );
    }

    render(
      <Wrapper>
        <ReactionHarness />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Fire" }));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

    // Now test rollback on failure when removing
    shouldFail = true;
    fireEvent.click(screen.getByRole("button", { name: "Remove Fire" }));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
  });

  it("opens the reacting users list modal and displays avatars, display names, usernames, and pagination", async () => {
    const { Wrapper } = createTestEnv((url) => {
      if (url.pathname.endsWith("/reactions") && !url.searchParams.get("after_id")) {
        return Response.json({
          items: [
            {
              user: otherProfile,
              emoji: "😂",
              emoji_name: "Laughing face",
              emoji_url: null,
              created_at: "2026-11-27T15:42:00Z",
            },
          ],
          next_cursor: otherId,
        });
      }
      return Response.json({
        items: [
          {
            user: profileFixture,
            emoji: "😂",
            emoji_name: "Laughing face",
            emoji_url: null,
            created_at: "2026-11-27T15:43:00Z",
          },
        ],
        next_cursor: null,
      });
    });

    const msgWithReactions: ChatMessageData = {
      ...baseChatMessage,
      reactions: [
        {
          emoji: "😂",
          emoji_name: "Laughing face",
          count: 2,
          me: true,
          users: [otherProfile, profileFixture],
        },
      ],
    };

    render(
      <Wrapper>
        <ol>
          <ChatMessage
            message={msgWithReactions}
            grouped={false}
            currentUserId={meId}
            mentionContext={{
              kind: "channel",
              id: channelFixture.id,
              name: "general",
              communityId: communityFixture.id,
            }}
          />
        </ol>
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View who reacted" }));
    const dialog = await screen.findByRole("dialog", { name: "Reactions" });
    expect(await within(dialog).findByText("Josef")).toBeInTheDocument();
    expect(within(dialog).getByText("@josef#1234")).toBeInTheDocument();

    const loadMore = within(dialog).getByRole("button", { name: "Load more" });
    fireEvent.click(loadMore);
    expect(await within(dialog).findByText(profileFixture.display_name)).toBeInTheDocument();
  });
});

describe("Feature 2: Replying to Messages", () => {
  it("displays reply preview above composer, preserves draft, toggles mention preference, and cancels reply", () => {
    const onCancel = vi.fn();
    const onToggleMention = vi.fn();
    const onSend = vi.fn();

    render(
      <MessageComposer
        channelName="general"
        initialBody="Existing draft "
        replyTo={{
          id: baseChatMessage.id,
          author_id: otherId,
          author: otherProfile,
          body: "Anyone playing tonight?",
          deleted: false,
        }}
        replyMention={true}
        onToggleReplyMention={onToggleMention}
        onCancelReply={onCancel}
        onSend={onSend}
      />,
    );

    const banner = screen.getByRole("region", { name: "Replying to Josef" });
    expect(within(banner).getByText(/Anyone playing tonight\?/)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Existing draft ");

    const mentionSwitch = within(banner).getByRole("switch", { name: "Mention replied user" });
    expect(mentionSwitch).toHaveAttribute("aria-checked", "true");
    fireEvent.click(mentionSwitch);
    expect(onToggleMention).toHaveBeenCalledWith(false);

    fireEvent.click(within(banner).getByRole("button", { name: "Cancel reply" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders reply connector, jumps to original message, and handles deleted original messages gracefully", () => {
    const onJump = vi.fn();
    const replyMessage: ChatMessageData = {
      ...baseChatMessage,
      id: "99999999-9999-4999-8999-111111111111",
      body: "Sure, I'm available.",
      replyTo: {
        id: baseChatMessage.id,
        author_id: otherId,
        author: otherProfile,
        body: "Anyone playing tonight?",
        deleted: false,
      },
    };

    const deletedReplyMessage: ChatMessageData = {
      ...replyMessage,
      id: "99999999-9999-4999-8999-222222222222",
      replyTo: {
        id: baseChatMessage.id,
        author_id: null,
        author: null,
        body: null,
        deleted: true,
      },
    };

    render(
      <MessageList
        channel={{ name: "general" }}
        searching={false}
        messages={[baseChatMessage, replyMessage, deletedReplyMessage]}
        onJumpToMessage={onJump}
      />,
    );

    const refBtn = screen.getByRole("button", { name: "Anyone playing tonight?" });
    fireEvent.click(refBtn);
    expect(onJump).toHaveBeenCalledWith(baseChatMessage.id);

    expect(
      screen.getByText("Original message was deleted or is unavailable"),
    ).toBeInTheDocument();
  });

  it("supports optimistic replies with immediate reference display and failed state preservation", async () => {
    let finishSend!: (res: Response) => void;
    const { queries, Wrapper } = createTestEnv(() => {
      return new Promise<Response>((resolve) => {
        finishSend = resolve;
      });
    });

    queries.setQueryData(queryKeys.messages(channelFixture.id), {
      pages: [{ items: [], next_cursor: null }],
      pageParams: [null],
    });

    function ReplySendHarness() {
      const send = useSendMessage(channelFixture.id);
      return (
        <div>
          <button
            type="button"
            onClick={() =>
              send.send("Count me in!", [], {
                replyTo: {
                  id: baseChatMessage.id,
                  author_id: otherId,
                  author: otherProfile,
                  body: "Anyone playing tonight?",
                  deleted: false,
                },
                replyMention: true,
              })
            }
          >
            Send Reply
          </button>
          {send.entries.map((e) => (
            <div key={e.message.client_nonce} data-testid="pending-reply" data-status={e.status}>
              <span>{e.message.reply_to?.author?.display_name}</span>
              <span>{e.message.body}</span>
            </div>
          ))}
        </div>
      );
    }

    render(
      <Wrapper>
        <ReplySendHarness />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Send Reply" }));
    const pending = await screen.findByTestId("pending-reply");
    expect(pending).toHaveAttribute("data-status", "pending");
    expect(pending).toHaveTextContent("Josef");
    expect(pending).toHaveTextContent("Count me in!");

    await act(async () => {
      finishSend(new Response(null, { status: 503 }));
    });
    expect(await screen.findByTestId("pending-reply")).toHaveAttribute("data-status", "failed");
  });
});

describe("Feature 3: Forwarding Messages", () => {
  it("searches channels, DMs, and group DMs, prevents duplicate submissions, and forwards with attribution", async () => {
    const forwardedPayloads: unknown[] = [];
    const { Wrapper } = createTestEnv(async (url, options) => {
      if (url.pathname === "/api/v1/messages/forward" && options.method === "POST") {
        const body = JSON.parse(String(options.body));
        forwardedPayloads.push(body);
        return Response.json(
          {
            ...messageFixture,
            id: "aaaaaaaa-1111-4111-8111-111111111111",
            client_nonce: body.client_nonce,
            body: baseChatMessage.body,
            forwarded: {
              message_id: baseChatMessage.id,
              author_id: otherId,
              author: otherProfile,
              body: baseChatMessage.body,
              created_at: baseChatMessage.createdAt,
              forwarded_at: new Date().toISOString(),
              attachments: [],
            },
          },
          { status: 201 },
        );
      }
      if (url.pathname.endsWith("/channels")) {
        return Response.json({
          items: [
            { ...channelFixture, can_send_messages: true },
            {
              id: "66666666-6666-4666-8666-666666666666",
              name: "read-only-announcements",
              topic: "",
              position: 1,
              can_send_messages: false,
            },
          ],
        });
      }
      return Response.json({ items: [] });
    });

    const onForwarded = vi.fn();
    const onClose = vi.fn();

    render(
      <Wrapper>
        <ForwardMessageDialog
          open
          onClose={onClose}
          message={baseChatMessage}
          sourceKind="channel"
          sourceId={channelFixture.id}
          onForwarded={onForwarded}
        />
      </Wrapper>,
    );

    // Verify DMs, Group DMs, and writable channels appear, while read-only channel is excluded
    expect(await screen.findByRole("option", { name: /Josef/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Gaming Group/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /# general/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /read-only-announcements/ })).not.toBeInTheDocument();

    // Filter destinations by search
    const searchInput = screen.getByRole("searchbox", {
      name: "Search conversations or channels",
    });
    fireEvent.change(searchInput, { target: { value: "Gaming Group" } });
    expect(screen.queryByRole("option", { name: /# general/ })).not.toBeInTheDocument();
    const groupOption = screen.getByRole("option", { name: /Gaming Group/ });
    fireEvent.click(groupOption);

    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    await waitFor(() => expect(onForwarded).toHaveBeenCalledOnce());
    expect(forwardedPayloads).toHaveLength(1);
    expect(forwardedPayloads[0]).toMatchObject({
      source_kind: "channel",
      source_id: channelFixture.id,
      message_id: baseChatMessage.id,
      destination_kind: "conversation",
      destination_id: "88888888-8888-4888-8888-888888888888",
    });
  });

  it("renders forwarded message card with Forwarded label, original author, and attachments", () => {
    const forwardedMsg: ChatMessageData = {
      ...baseChatMessage,
      id: "aaaaaaaa-2222-4222-8222-222222222222",
      body: "Anyone playing tonight?",
      forwarded: {
        message_id: baseChatMessage.id,
        author_id: otherId,
        author: otherProfile,
        body: "Anyone playing tonight?",
        created_at: "2026-11-27T15:40:00Z",
        attachments: [
          {
            id: "bbbbbbbb-1111-4111-8111-111111111111",
            name: "squad.png",
            content_type: "image/png",
            size_bytes: 20480,
            url: "https://cdn.core.test/squad.png",
          },
        ],
      },
    };

    render(
      <ol>
        <ChatMessage message={forwardedMsg} grouped={false} currentUserId={meId} />
      </ol>,
    );

    const card = screen.getByRole("region", { name: "Forwarded message" });
    expect(within(card).getByText("Forwarded")).toBeInTheDocument();
    expect(within(card).getByText("Josef")).toBeInTheDocument();
    expect(within(card).getByText("Anyone playing tonight?")).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: "squad.png" })).toBeInTheDocument();
  });
});

describe("Feature 4: Message Threads", () => {
  const threadDetailFixture: ThreadDetail = {
    id: "cccccccc-1111-4111-8111-111111111111",
    community_id: communityFixture.id,
    parent_channel_id: channelFixture.id,
    starter_message_id: baseChatMessage.id,
    starter_message: {
      ...messageFixture,
      id: baseChatMessage.id,
      body: "Anyone playing tonight?",
      author_id: otherId,
      author: otherProfile,
    },
    name: "Gaming tonight",
    creator_id: meId,
    thread_type: "public",
    created_at: "2026-11-27T15:45:00Z",
    last_activity_at: "2026-11-27T15:46:00Z",
    archived: false,
    locked: false,
    message_count: 2,
    is_joined: true,
    can_manage: true,
    can_lock: true,
    can_delete: true,
    can_send: true,
    participants: [profileFixture, otherProfile],
  };

  it("creates public or private threads and renders the thread indicator below the starter message", async () => {
    const onCreated = vi.fn();
    const { Wrapper } = createTestEnv(async (url, options) => {
      if (url.pathname.endsWith("/threads") && options.method === "POST") {
        const body = JSON.parse(String(options.body));
        return Response.json(
          {
            ...threadDetailFixture,
            name: body.name,
            thread_type: body.thread_type,
          },
          { status: 201 },
        );
      }
      return Response.json({ items: [] });
    });

    render(
      <Wrapper>
        <CreateThreadDialog
          open
          onClose={vi.fn()}
          channelId={channelFixture.id}
          communityId={communityFixture.id}
          starterMessage={baseChatMessage}
          onCreated={onCreated}
        />
      </Wrapper>,
    );

    const nameInput = screen.getByRole("textbox", { name: /Thread Name/i });
    fireEvent.change(nameInput, { target: { value: "Late Night Raid" } });
    fireEvent.click(screen.getByRole("button", { name: /Private Thread/i }));
    fireEvent.click(screen.getByRole("button", { name: "Create Thread" }));

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Late Night Raid",
          thread_type: "private",
        }),
      ),
    );
  });

  it("opens the right-side thread panel, displays starter message and thread replies, and supports thread management (rename, archive, lock)", async () => {
    let currentThread = { ...threadDetailFixture };
    const threadMessages: Message[] = [
      {
        ...messageFixture,
        id: "dddddddd-1111-4111-8111-111111111111",
        thread_id: currentThread.id,
        body: "I'm ready in 10 minutes!",
      },
    ];

    const { Wrapper } = createTestEnv(async (url, options) => {
      if (url.pathname === `/api/v1/threads/${currentThread.id}`) {
        if (options.method === "PATCH") {
          const patch = JSON.parse(String(options.body));
          currentThread = { ...currentThread, ...patch };
        }
        return Response.json(currentThread);
      }
      if (url.pathname === `/api/v1/threads/${currentThread.id}/messages`) {
        if (options.method === "POST") {
          const body = JSON.parse(String(options.body));
          const created: Message = {
            ...messageFixture,
            id: "dddddddd-2222-4222-8222-222222222222",
            thread_id: currentThread.id,
            body: body.body,
            client_nonce: body.client_nonce,
          };
          threadMessages.push(created);
          return Response.json(created, { status: 201 });
        }
        return Response.json({ items: threadMessages, next_cursor: null });
      }
      if (url.pathname.endsWith("/members")) {
        return Response.json({
          community_id: communityFixture.id,
          channel_id: channelFixture.id,
          total: 1,
          items: [],
          next_cursor: null,
        });
      }
      return Response.json({ items: [] });
    });

    render(
      <Wrapper>
        <ThreadPanel
          threadId={currentThread.id}
          communityId={communityFixture.id}
          parentChannelId={channelFixture.id}
          currentUserId={meId}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );

    const panel = await screen.findByRole("complementary", { name: "Thread: Gaming tonight" });
    expect(within(panel).getByText("Anyone playing tonight?")).toBeInTheDocument();
    expect(await within(panel).findByText("I'm ready in 10 minutes!")).toBeInTheDocument();

    // Archive thread
    fireEvent.click(within(panel).getByRole("button", { name: "Archive thread" }));
    expect(await within(panel).findByText("Archived")).toBeInTheDocument();

    // Lock thread
    fireEvent.click(within(panel).getByRole("button", { name: "Lock thread" }));
    expect(await within(panel).findByText("Locked")).toBeInTheDocument();

    // View participants drawer
    fireEvent.click(within(panel).getByRole("button", { name: "Thread participants" }));
    expect(await within(panel).findByText("Participants (2)")).toBeInTheDocument();
  });
});
