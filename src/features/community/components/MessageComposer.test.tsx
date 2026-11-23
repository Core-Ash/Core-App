import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageComposer } from "@/features/community/components/MessageComposer";
import { ApiError } from "@/lib/api/errors";

describe("persisted message composer", () => {
  it("clears immediately and allows the next message without awaiting delivery", () => {
    const send = vi.fn();
    render(<MessageComposer channelName="general" onSend={send} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "  First message  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.submit(screen.getByRole("form"));
    expect(send).toHaveBeenCalledExactlyOnceWith("First message");
    expect(input).toHaveValue("");
    expect(input).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Message queued.");
    fireEvent.change(input, { target: { value: "Second message" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("keeps input if it cannot be queued", () => {
    const send = vi.fn(() => { throw new ApiError("unauthorized"); });
    render(<MessageComposer channelName="general" onSend={send} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Keep this draft" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent("Your draft has been kept");
    expect(input).toHaveValue("Keep this draft");
  });
  it("preserves multiline and IME input and rejects blank or oversized messages", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    render(<MessageComposer channelName="general" onSend={send} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: " \n " } });
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "First line\nSecond line" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(send).not.toHaveBeenCalled();
    expect(input).toHaveValue("First line\nSecond line");
    fireEvent.change(input, { target: { value: "a".repeat(4001) } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent("4000 characters");
    expect(send).not.toHaveBeenCalled();
    // Rust counts Unicode scalar values rather than UTF-16 code units.
    fireEvent.change(input, { target: { value: "🎮".repeat(4000) } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
  });
  it("inserts an emoji without sending and labels unsupported uploads", () => {
    const send = vi.fn();
    render(<MessageComposer channelName="general" onSend={send} />);
    fireEvent.click(screen.getByLabelText("Choose an emoji"));
    fireEvent.click(within(screen.getByRole("form")).getByRole("button", { name: "Eyes" }));
    expect(screen.getByRole("textbox")).toHaveValue("👀");
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Attachments unavailable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Image uploads unavailable" })).toBeDisabled();
    expect(send).not.toHaveBeenCalled();
  });
  it("renders disabled read-only bar when user lacks send permissions", () => {
    const send = vi.fn();
    render(<MessageComposer channelName="dragon-hunt" canSendMessages={false} onSend={send} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Messaging disabled" })).toBeInTheDocument();
    expect(screen.getByText("You do not have permission to send messages in #dragon-hunt.")).toBeInTheDocument();
  });
});
