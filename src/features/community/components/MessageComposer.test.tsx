import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageComposer } from "@/features/community/components/MessageComposer";
import { ApiError } from "@/lib/api/errors";

describe("persisted message composer", () => {
  it("blocks duplicate sends and announces success only after confirmation", async () => {
    let finish!: () => void;
    const send = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<MessageComposer channelName="general" onSend={send} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "  Ready for the next round.  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.submit(screen.getByRole("form"));
    expect(send).toHaveBeenCalledExactlyOnceWith("Ready for the next round.");
    expect(input).toBeDisabled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    await act(async () => { finish(); });
    expect(input).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("Message sent.");
  });
  it("keeps a failed draft without reporting success and allows explicit retry", async () => {
    const send = vi.fn().mockRejectedValueOnce(new ApiError("unavailable")).mockResolvedValue(undefined);
    render(<MessageComposer channelName="general" onSend={send} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Keep this draft" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Your draft has been kept");
    expect(input).toHaveValue("Keep this draft");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(input).toHaveValue(""));
    expect(send).toHaveBeenCalledTimes(2);
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
});
