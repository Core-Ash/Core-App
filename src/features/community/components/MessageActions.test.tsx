import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatMessage } from "@/features/community/components/ChatMessage";
import type { ChatMessageData } from "@/features/community/types";
import { plainMessageText } from "@/features/mentions/model";

const me = "11111111-1111-4111-8111-111111111111";
const context = { kind: "channel", id: "c", name: "general", communityId: "k" } as const;
const message: ChatMessageData = {
  id: "44444444-4444-4444-8444-444444444444", body: "Hi @Ash\nsecond line", createdAt: "2026-11-27T03:00:00Z",
  author: { id: me, name: "Me", initials: "M", tone: "slate" },
  mentions: [{ kind: "user", id: "u", start: 3, end: 7, label: "Renamed" }],
};

describe("message actions", () => {
  it("renders no permanent edit/delete links and a toolbar with unavailable and live controls", () => {
    render(<ol><ChatMessage message={message} grouped={false} currentUserId={me} mentionContext={context} /></ol>);
    expect(screen.queryByText("Edit message")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete message")).not.toBeInTheDocument();
    const toolbar = screen.getByRole("toolbar", { name: "Message actions" });
    expect(within(toolbar).getByRole("button", { name: "Add reaction (unavailable)" })).toBeDisabled();
    expect(within(toolbar).getByRole("button", { name: "Reply (unavailable)" })).toBeDisabled();
    expect(within(toolbar).getByRole("button", { name: "More options" })).toBeEnabled();
  });
  it("opens the same author menu by right-click and the three-dot button, then closes on Escape", async () => {
    const { container } = render(<ol><ChatMessage message={message} grouped={false} currentUserId={me} mentionContext={context} /></ol>);
    fireEvent.contextMenu(container.querySelector(".message-body")!);
    let menu = await screen.findByRole("menu", { name: "Message actions" });
    for (const name of ["Copy Text", "Edit Message", "Delete Message", "Copy Message ID"]) expect(within(menu).getByRole("menuitem", { name })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Reply/ })).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    menu = await screen.findByRole("menu", { name: "Message actions" });
    expect(within(menu).getByRole("menuitem", { name: "Edit Message" })).toBeInTheDocument();
  });
  it("hides edit and delete for other users' messages and for DM-less/optimistic rows", async () => {
    const { container, rerender } = render(<ol><ChatMessage message={message} grouped={false} currentUserId="someone-else" mentionContext={context} /></ol>);
    fireEvent.contextMenu(container.querySelector(".message-body")!);
    const menu = await screen.findByRole("menu", { name: "Message actions" });
    expect(within(menu).queryByRole("menuitem", { name: "Edit Message" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Delete Message" })).not.toBeInTheDocument();
    fireEvent.keyDown(menu, { key: "Escape" });
    rerender(<ol><ChatMessage message={{ ...message, delivery: "pending" }} grouped={false} currentUserId={me} mentionContext={context} /></ol>);
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });
  it("copies readable text with current mention labels and the real message ID", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { container } = render(<ol><ChatMessage message={message} grouped={false} currentUserId={me} mentionContext={context} /></ol>);
    fireEvent.contextMenu(container.querySelector(".message-body")!);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Copy Text" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Hi @Renamed\nsecond line"));
    fireEvent.contextMenu(container.querySelector(".message-body")!);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Copy Message ID" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(message.id));
    expect(plainMessageText("@x", [{ kind: "everyone", start: 0, end: 2 }])).toBe("@x");
  });
  it("keeps grouped rows free of header, avatar and primary stamp", () => {
    const { container } = render(<ol><ChatMessage message={message} grouped currentUserId={me} /></ol>);
    expect(container.querySelector(".message-meta")).toBeNull();
    expect(container.querySelector(".grouped-timestamp")).toBeInTheDocument();
  });
});
