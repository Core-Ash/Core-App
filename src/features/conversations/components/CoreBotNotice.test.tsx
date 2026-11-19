import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CoreBotNotice } from "@/features/conversations/components/CoreBotNotice";

describe("CoreBotNotice", () => {
  it("renders Core Bot delivery failure notice with bot badge, title, explanation, and timestamp", () => {
    const onDismiss = vi.fn();
    render(
      <CoreBotNotice
        notice={{
          id: "notice-123",
          createdAt: "2026-11-19T14:30:00Z",
        }}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Core Bot")).toBeInTheDocument();
    expect(screen.getByText("BOT")).toBeInTheDocument();
    expect(
      screen.getByText("Your message could not be delivered."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This may be because you cannot message this user, your privacy settings prevent delivery, or messaging is currently unavailable\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Only you can see this")).toBeInTheDocument();

    const dismissButton = screen.getByRole("button", {
      name: "Dismiss message",
    });
    expect(dismissButton).toBeInTheDocument();

    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
