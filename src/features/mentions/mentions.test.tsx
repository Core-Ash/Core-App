import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageComposer } from "@/features/community/components/MessageComposer";
import { ConversationMentionComposer } from "./MentionComposers";
import { MentionText } from "./MentionText";
import { mentionPayload, mentionQuery, reconcileMentionEdit, reconcileMentions, type MentionSuggestion } from "./model";
import { parseMessage } from "@/lib/api/contracts";
import { messageFixture, profileFixture } from "@/test/api-fixtures";

const ash: MentionSuggestion = { kind: "user", id: profileFixture.id, label: "Ash", profile: { ...profileFixture, display_name: "Ash" } };
const role: MentionSuggestion = { kind: "role", id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", label: "Moderator" };
function type(input: HTMLElement, value: string, caret = value.length) {
  fireEvent.change(input, { target: { value, selectionStart: caret, selectionEnd: caret } });
}
describe("mention spans", () => {
  it("detects caret queries anywhere while excluding emails, selections and existing mentions", () => {
    expect(mentionQuery("before @ash after", 11, 11, [])).toEqual({ start: 7, end: 11, search: "ash" });
    expect(mentionQuery("line\n@", 6, 6, [])?.search).toBe("");
    expect(mentionQuery("a@b.com", 7, 7, [])).toBeNull();
    expect(mentionQuery("@Ash", 4, 4, [{ kind: "user", id: ash.id, start: 0, end: 4 }])).toBeNull();
    expect(mentionQuery("@a", 1, 2, [])).toBeNull();
  });
  it("moves stable IDs across Unicode edits and removes identities when labels are edited", () => {
    const spans = [{ kind: "user" as const, id: ash.id, start: 3, end: 7 }];
    expect(reconcileMentions("🙂 @Ash", "Hi 🙂 @Ash", spans)[0]).toMatchObject({ start: 6, end: 10, id: ash.id });
    expect(reconcileMentions("🙂 @Ash", "🙂 @Ash!", spans)).toEqual(spans);
    expect(reconcileMentions("🙂 @Ash", "🙂 @Axsh", spans)).toEqual([]);
    expect(mentionPayload([{ ...spans[0]!, label: "Untrusted", profile: profileFixture }])).toEqual(spans);
  });
  it("keeps the correct account when deleting one of two identical labels", () => {
    const first = { kind: "user" as const, id: ash.id, start: 0, end: 4 };
    const second = { kind: "user" as const, id: role.id, start: 5, end: 9 };
    expect(reconcileMentionEdit("@Ash @Ash", "@Ash", [first, second], 0, 5)).toEqual([{ ...second, start: 0, end: 4 }]);
  });
  it("parses old plain-text messages and rejects overlapping or mismatched metadata", () => {
    expect(parseMessage(messageFixture).mentions).toBeUndefined();
    expect(() => parseMessage({ ...messageFixture, body: "@Ash", mentions: [{ kind: "user", id: ash.id, start: 0, end: 9 }] })).toThrow();
    expect(() => parseMessage({ ...messageFixture, body: "@Ash", mentions: [{ kind: "user", id: ash.id, start: 0, end: 4, profile: { ...profileFixture, id: role.id } }] })).toThrow();
  });
});
describe("mention composer", () => {
  it("sends an unmatched @query as ordinary text after search finishes", () => {
    const send = vi.fn();
    render(<MessageComposer channelName="general" onSend={send} onMentionSearch={() => {}} mentionSuggestions={[]} />);
    const input = screen.getByRole("textbox"); type(input, "@unmatched");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(send).toHaveBeenCalledExactlyOnceWith("@unmatched");
  });
  it("opens at @, selects with Enter without sending, and sends stable metadata", async () => {
    const send = vi.fn(); const search = vi.fn();
    render(<MessageComposer channelName="general" onSend={send} onMentionSearch={search} mentionSuggestions={[ash, role]} />);
    const input = screen.getByRole("textbox");
    type(input, "@");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(send).not.toHaveBeenCalled();
    expect(input).toHaveValue("@Moderator ");
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.keyDown(input, { key: "Enter" });
    expect(send).toHaveBeenCalledWith("@Moderator", [expect.objectContaining({ kind: "role", id: role.id, start: 0, end: 10 })]);
  });
  it("inserts in the middle, preserves suffix and caret, and supports multiple mentions", async () => {
    const send = vi.fn();
    render(<MessageComposer channelName="general" onSend={send} onMentionSearch={() => {}} mentionSuggestions={[ash]} />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    type(input, "Hello @a world", 8);
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input).toHaveValue("Hello @Ash  world");
    await waitFor(() => expect(input.selectionStart).toBe(11));
    type(input, "Hello @Ash  world @");
    fireEvent.click(screen.getByRole("option", { name: /Ash/ }));
    fireEvent.keyDown(input, { key: "Enter" });
    expect(send.mock.calls[0]![1]).toHaveLength(2);
    expect(send.mock.calls[0]![1].every((m: { id: string }) => m.id === ash.id)).toBe(true);
  });
  it("dismisses Escape, ignores IME selection and keeps async failed drafts", async () => {
    const send = vi.fn().mockRejectedValue(new Error("failed"));
    render(<MessageComposer channelName="general" onSend={send} onMentionSearch={() => {}} mentionSuggestions={[ash]} />);
    const input = screen.getByRole("textbox"); type(input, "@");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(input).toHaveValue("@");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Your draft has been kept"));
    expect(input).toHaveValue("@");
  });
  it("suggests only provided private participants, matches discriminator, and never offers roles", () => {
    render(<ConversationMentionComposer channelName="Group" participants={[{ ...profileFixture, display_name: "Ash", discriminator: "2662" }]} onSend={vi.fn()} />);
    const input = screen.getByRole("textbox"); type(input, "@2662");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("2662");
    type(input, "@Moderator");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
describe("mention rendering", () => {
  it("opens the existing profile popover and highlights the current user", () => {
    render(<MentionText body="@Ash" currentUserId={ash.id} mentions={[{ kind: "user", id: ash.id, start: 0, end: 4, label: "Renamed", profile: { ...profileFixture, display_name: "Renamed" } }]} />);
    const mention = screen.getByRole("button", { name: "@Renamed" });
    expect(mention).toHaveClass("message-mention--personal");
    fireEvent.click(mention);
    expect(screen.getByRole("dialog", { name: "Renamed" })).toBeInTheDocument();
  });
  it("uses current names and treats HTML labels as text", () => {
    const { container } = render(<MentionText body="Hello @Old!" mentions={[{ kind: "role", id: role.id, start: 6, end: 10, label: "<script>bad</script>", color: "#ff0000" }]} />);
    expect(container).toHaveTextContent("Hello @<script>bad</script>!");
    expect(container.querySelector("script")).toBeNull();
  });
});

