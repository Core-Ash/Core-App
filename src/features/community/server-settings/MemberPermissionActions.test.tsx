import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { MemberPermissionActions } from "./MemberPermissionActions";
import type { ServerSettingsData } from "./types";
import type { ServerMember } from "@/lib/api/types";
const patch = vi.fn();
vi.mock("@/app/app-data-context", () => ({ useAppData: () => ({ api: { patch } }) }));
beforeEach(() => { patch.mockReset().mockResolvedValue({}); });
function setup(grants: string[], self = false) {
  render(<QueryClientProvider client={new QueryClient()}><MemberPermissionActions
    settings={{ id: "server", owner_id: "owner", permissions: { effective_permissions: grants } } as ServerSettingsData}
    member={{ id: "member", display_name: "Global Name", nickname: null } as ServerMember}
    currentUserId={self ? "member" : "actor"}
  /></QueryClientProvider>);
}
it("uses server-granted capabilities and keeps self nickname separate from moderation", () => {
  setup(["nicknames.change", "members.moderate"], true);
  expect(screen.getByRole("button", { name: "Nickname" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Timeout" })).not.toBeInTheDocument();
});
it("submits server-local nickname without changing the global profile", async () => {
  setup(["nicknames.manage"]);
  fireEvent.click(screen.getByRole("button", { name: "Nickname" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Nickname" }), { target: { value: "Server Name" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(patch).toHaveBeenCalledWith("/communities/server/members/member/nickname", { nickname: "Server Name" }));
});
it("preserves the timeout draft when the backend rejects moderation", async () => {
  patch.mockRejectedValue(new Error("Forbidden"));
  setup(["members.moderate"]);
  fireEvent.click(screen.getByRole("button", { name: "Timeout" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Reason (optional)" }), { target: { value: "Review" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Your draft is preserved");
  expect(screen.getByRole("textbox", { name: "Reason (optional)" })).toHaveValue("Review");
  expect(patch).toHaveBeenCalledWith("/communities/server/members/member/timeout", { duration_seconds: 600, reason: "Review" });
});
