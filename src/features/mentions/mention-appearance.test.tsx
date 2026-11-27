import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMessage } from "@/features/community/components/ChatMessage";
import type { ChatMessageData } from "@/features/community/types";
import { MentionText } from "./MentionText";
import { profileFixture } from "@/test/api-fixtures";

const target = profileFixture.id;
const message: ChatMessageData = {
  id: "mentioned", body: "Hello @Ash", createdAt: "2026-11-27T03:00:00Z",
  author: { id: "author", name: "Author", initials: "A", tone: "slate" },
  mentions: [{ kind: "user", id: target, start: 6, end: 10, label: "Ash" }],
};
describe("mention appearance and interactions", () => {
  it("highlights only the relevant grouped entry, including optimistic entries", () => {
    const { container } = render(<ol>
      <ChatMessage message={{ ...message, id: "first", mentions: [] }} grouped={false} currentUserId={target} />
      <ChatMessage message={{ ...message, delivery: "pending" }} grouped={true} currentUserId={target} />
      <ChatMessage message={{ ...message, id: "last", mentions: [] }} grouped={true} currentUserId={target} />
    </ol>);
    const rows = container.querySelectorAll(".chat-message");
    expect(rows[0]).not.toHaveClass("message-mentioned");
    expect(rows[1]).toHaveClass("message-mentioned", "message-grouped", "message-pending");
    expect(rows[2]).not.toHaveClass("message-mentioned");
  });
  it("highlights messages for matching role mentions and @everyone/@here, but not unmatched roles", () => {
    const roleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const { container } = render(<ol>
      <ChatMessage
        message={{
          ...message,
          id: "role-match",
          body: "Hello @Moderator",
          mentions: [{ kind: "role", id: roleId, start: 6, end: 16, label: "Moderator" }],
        }}
        grouped={false}
        currentUserId={target}
        currentUserRoleIds={[roleId]}
      />
      <ChatMessage
        message={{
          ...message,
          id: "role-miss",
          body: "Hello @Moderator",
          mentions: [{ kind: "role", id: roleId, start: 6, end: 16, label: "Moderator" }],
        }}
        grouped={false}
        currentUserId={target}
        currentUserRoleIds={["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]}
      />
      <ChatMessage
        message={{
          ...message,
          id: "everyone-match",
          body: "Attention @everyone",
          mentions: [{ kind: "everyone", start: 10, end: 19, label: "everyone" }],
        }}
        grouped={true}
        currentUserId={target}
      />
      <ChatMessage
        message={{
          ...message,
          id: "here-match",
          body: "Attention @here",
          mentions: [{ kind: "here", start: 10, end: 15, label: "here" }],
        }}
        grouped={true}
        currentUserId={target}
      />
    </ol>);
    const rows = container.querySelectorAll(".chat-message");
    expect(rows[0]).toHaveClass("message-mentioned");
    expect(rows[1]).not.toHaveClass("message-mentioned");
    expect(rows[2]).toHaveClass("message-mentioned", "message-grouped");
    expect(rows[3]).toHaveClass("message-mentioned", "message-grouped");
  });
  it("does not highlight other users, plain text, invalid spans, deleted messages or a missing session", () => {
    const { container } = render(<ol>
      <ChatMessage message={message} grouped={false} currentUserId="other" />
      <ChatMessage message={{ ...message, mentions: [] }} grouped={false} currentUserId={target} />
      <ChatMessage message={{ ...message, body: "@everyone @here @Ash", mentions: [] }} grouped={false} currentUserId={target} />
      <ChatMessage message={{ ...message, mentions: [{ ...message.mentions![0]!, end: 99 }] }} grouped={false} currentUserId={target} />
      <ChatMessage message={{ ...message, deleted: true }} grouped={false} currentUserId={target} />
      <ChatMessage message={message} grouped={false} />
    </ol>);
    expect(container.querySelector(".message-mentioned")).toBeNull();
  });
  it("keeps punctuation and consecutive role/mass mentions intact with shared styling independent of role color", () => {
    const { container } = render(<MentionText body="@Role,@everyone @here!" mentions={[
      { kind: "role", id: "role", start: 0, end: 5, color: "#000000" },
      { kind: "everyone", start: 6, end: 15 },
      { kind: "here", start: 16, end: 21 },
    ]} />);
    expect(container).toHaveTextContent("@Role,@everyone @here!");
    expect(container.querySelectorAll(".message-mention")).toHaveLength(3);
    expect(container.querySelectorAll(".message-mention--mass")).toHaveLength(2);
    const role = container.querySelector<HTMLElement>(".message-mention--role")!;
    expect(role.style.color).toBe("");
    expect(role).not.toHaveAttribute("style");
  });
  it.each(["Enter", " "])("opens the correct long-name profile with %s without a standalone button box", (key) => {
    const name = "A long display name that wraps with surrounding message text";
    render(<MentionText body="@Ash" mentions={[{ kind: "user", id: target, start: 0, end: 4, label: name, profile: { ...profileFixture, display_name: name } }]} />);
    const mention = screen.getByRole("button", { name: `@${name}` });
    expect(mention.tagName).toBe("SPAN");
    expect(mention).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(mention, { key });
    expect(screen.getByRole("dialog", { name })).toBeInTheDocument();
  });
});
