import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AuthContext } from "@/features/auth/auth-context";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";
import { CommunityPage } from "@/features/community/CommunityPage";

function renderPreview(path = "/app") {
  return render(
    <AuthContext.Provider
      value={{ ...signedOutState, session: sessionFixture }}
    >
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
        <Routes>
          <Route path="/app" element={<CommunityPage />} />
          <Route path="/app/communities" element={<CommunityPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("community design preview", () => {
  it("uses the session identity and renders the five reference messages", () => {
    renderPreview();
    const account = screen.getByRole("region", { name: "Signed-in account" });
    expect(within(account).getByText("Alex Morgan")).toBeInTheDocument();
    expect(within(account).queryByText("Nex")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Messages" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(5);
    expect(screen.queryByText("Good games.")).not.toBeInTheDocument();
  });

  it("adds and removes a new local reaction", () => {
    renderPreview();
    const messages = screen.getByRole("list", { name: "Messages" });
    fireEvent.click(within(messages).getByLabelText("Add a local reaction"));
    fireEvent.click(within(messages).getByRole("button", { name: "Eyes" }));
    const reaction = screen.getByRole("button", {
      name: "Eyes, 1 reaction (local preview)",
    });
    expect(reaction).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(reaction);
    expect(
      screen.queryByRole("button", {
        name: "Eyes, 0 reactions (local preview)",
      }),
    ).not.toBeInTheDocument();
  });

  it("expands the remaining five offline sample members", () => {
    renderPreview();
    fireEvent.click(screen.getByRole("button", { name: "Show members" }));
    const dialog = screen.getByRole("dialog", { name: "Community members" });
    fireEvent.click(within(dialog).getByRole("button", { name: "+5 more" }));
    expect(within(dialog).getByText("Nova")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Show fewer" }));
    expect(within(dialog).queryByText("Nova")).not.toBeInTheDocument();
  });
  it("identifies sample data and keeps unsupported service controls disabled", () => {
    renderPreview();
    expect(screen.getByText(/Design preview · sample/)).toBeInTheDocument();
    expect(
      screen.getByText(/Messages aren’t sent or saved/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Lobby — voice connection unavailable",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Microphone unavailable/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Deafen unavailable/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Attachments unavailable/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Notifications unavailable/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Account settings" }),
    ).toHaveAttribute("href", "/app/settings");
  });

  it("adds an Enter-submitted message only to memory without a network call", () => {
    const request = vi.spyOn(globalThis, "fetch");
    renderPreview();
    const input = screen.getByRole("textbox", {
      name: "Message #general (local preview)",
    });
    fireEvent.change(input, {
      target: { value: "  Ready for the next round.  " },
    });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(
      within(screen.getByRole("list", { name: "Messages" })).getByText(
        "Ready for the next round.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Only visible to you")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Message added to the local preview",
    );
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(request).not.toHaveBeenCalled();
  });

  it("blocks empty drafts and preserves multiline and IME input", () => {
    renderPreview();
    const input = screen.getByRole("textbox", {
      name: "Message #general (local preview)",
    });
    const send = screen.getByRole("button", {
      name: "Send local preview message",
    });
    fireEvent.change(input, { target: { value: " \n " } });
    expect(send).toBeDisabled();
    fireEvent.change(input, { target: { value: "First line\nSecond line" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(input).toHaveValue("First line\nSecond line");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(input).toHaveValue("First line\nSecond line");
    fireEvent.click(send);
    expect(
      within(screen.getByRole("list", { name: "Messages" })).getByText(
        /First line/,
      ),
    ).toHaveTextContent("First line Second line");
    expect(input).toHaveValue("");
  });

  it("isolates messages by community and channel, retaining them while switching channels", () => {
    renderPreview();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "General-only local message" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send local preview message" }),
    );
    fireEvent.click(screen.getByRole("link", { name: "clips" }));
    expect(
      screen.getByRole("heading", { name: "A little quiet in here." }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("General-only local message"),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Clips-only local message" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send local preview message" }),
    );
    fireEvent.click(screen.getByRole("link", { name: "general" }));
    expect(screen.getByText("General-only local message")).toBeInTheDocument();
    expect(
      screen.queryByText("Clips-only local message"),
    ).not.toBeInTheDocument();
  });

  it("filters message text and author names and provides a search empty state", () => {
    renderPreview();
    const search = screen.getByRole("searchbox", {
      name: "Search messages in this channel",
    });
    fireEvent.change(search, { target: { value: "NEW MAP" } });
    expect(
      within(
        screen.getByRole("region", { name: "general message history" }),
      ).getByRole("status"),
    ).toHaveTextContent("1 matching message");
    expect(screen.getByText("New map looks insane")).toBeInTheDocument();
    expect(
      screen.queryByText(/Anyone up for some ranked/),
    ).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "Nex" } });
    expect(screen.getByText("Sounds good!")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "no-such-message" } });
    expect(
      screen.getByRole("heading", { name: "No matching messages" }),
    ).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByText(/Anyone up for some ranked/)).toBeInTheDocument();
  });

  it("toggles a local reaction and its accessible count", () => {
    renderPreview();
    const reaction = screen.getByRole("button", {
      name: "Fire, 5 reactions (local preview)",
    });
    fireEvent.click(reaction);
    expect(reaction).toHaveAttribute("aria-pressed", "true");
    expect(reaction).toHaveAccessibleName("Fire, 6 reactions (local preview)");
    fireEvent.click(reaction);
    expect(reaction).toHaveAttribute("aria-pressed", "false");
    expect(reaction).toHaveAccessibleName("Fire, 5 reactions (local preview)");
  });

  it("inserts an emoji into the draft without sending it", () => {
    renderPreview();
    fireEvent.click(screen.getByLabelText("Choose an emoji"));
    fireEvent.click(
      within(
        screen.getByRole("form", { name: "Local preview message composer" }),
      ).getByRole("button", { name: "Eyes" }),
    );
    expect(screen.getByRole("textbox")).toHaveValue("👀");
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("shows a community with empty channels and no active voice users", () => {
    renderPreview("/app/communities?community=outpost&channel=clips");
    expect(screen.getByRole("heading", { name: "clips" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "A little quiet in here." }),
    ).toBeInTheDocument();
    expect(screen.getByText("No active voice users.")).toBeInTheDocument();
  });

  it("opens a keyboard-dismissable member dialog and restores focus on narrow layouts", async () => {
    renderPreview();
    fireEvent.click(screen.getByRole("button", { name: "Show members" }));
    const dialog = screen.getByRole("dialog", { name: "Community members" });
    expect(
      within(dialog).getByRole("heading", {
        name: "Sample members and game activity",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("region", {
        name: "Playing sample members",
      }),
    ).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Show members" }),
      ).toHaveFocus(),
    );
  });

  it("handles unknown preview query values without inventing channels", () => {
    renderPreview(
      "/app/communities?community=missing&channel=missing&view=missing",
    );
    expect(
      screen.getByRole("heading", { name: "general" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "general" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
