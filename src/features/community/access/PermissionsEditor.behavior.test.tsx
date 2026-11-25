import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { AppDataContext } from "@/app/app-data-context";
import { createApiClient } from "@/lib/api/client";
import { PERMISSIONS } from "@/features/community/permissions/registry";
import { PermissionsEditor } from "./PermissionsEditor";
import { parsePermissionSnapshot, type PermissionSnapshot } from "./permission-model";

const initial: PermissionSnapshot = {
  version: "v1", resource: { name: "general", kind: "text" }, entries: [],
  grantable: PERMISSIONS.filter(p => p.status === "enforced").map(p => p.key),
  roles: [{ id: "everyone", name: "@everyone", is_default: true, color: null, manageable: true }, { id: "role", name: "Member", is_default: false, color: "#ff0000", manageable: true }],
  members: [{ id: "member", name: "Ash", username: "ash", avatar_url: null, manageable: true }],
};
afterEach(() => vi.unstubAllGlobals());
function setup(snapshot = initial, kind: "channels" | "categories" = "channels", pending?: () => Promise<Response>) {
  let saved = structuredClone(snapshot);
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === "PUT") {
      if (pending) return pending();
      const input = JSON.parse(options.body as string) as { changes: PermissionSnapshot["entries"]; sync: boolean };
      for (const change of input.changes) { saved.entries = saved.entries.filter(e => !(e.kind === change.kind && e.id === change.id && e.permission === change.permission)); if (change.state !== null) saved.entries.push(change); }
      saved = { ...saved, version: "v2", resource: { ...saved.resource, sync_with_category: input.sync } };
    }
    return Response.json(saved);
  });
  vi.stubGlobal("fetch", fetcher);
  const api = createApiClient({ baseUrl: "https://core.test", sessionSignal: () => new AbortController().signal, onUnauthorized: async () => "active" });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><AppDataContext.Provider value={{ api, ready: true, configured: true, configurationError: null, clearPrivateData: vi.fn() }}><PermissionsEditor communityId="server" resourceId="channel" kind={kind} /></AppDataContext.Provider></QueryClientProvider>);
  return { fetcher, queries };
}
function savedBody(fetcher: ReturnType<typeof setup>["fetcher"]) { return JSON.parse(fetcher.mock.calls.find(c => c[1]?.method === "PUT")![1]!.body as string) as { version: string; sync: boolean; changes: PermissionSnapshot["entries"] }; }

it("shows all applicable text options using channel labels and honest implementation status", async () => {
  setup(); await screen.findByRole("group", { name: "View Channel" });
  for (const name of ["Manage Channel", "Manage Permissions", "Manage Webhooks", "Create Invite", "Send Messages in Threads", "Create Public Threads", "Create Private Threads", "Embed Links", "Attach Files", "Add Reactions", "Use External Emojis", "Use External Stickers", "Mention @everyone, @here, and All Roles", "Manage Messages", "Pin Messages", "Bypass Slowmode", "Manage Threads", "Read Message History", "Send Text-to-Speech Messages", "Send Voice Messages", "Create Polls", "Use Application Commands", "Use Activities", "Use External Apps"]) expect(screen.getByRole("group", { name })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Allow Attach Files" })).toBeDisabled();
  expect(screen.queryByRole("group", { name: "Connect" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Administrator" })).not.toBeInTheDocument();
});
it("filters voice resources and exposes the union for categories", async () => {
  setup({ ...initial, resource: { name: "Voice", kind: "voice" } });
  await screen.findByRole("group", { name: "Connect" });
  expect(screen.getByRole("button", { name: "Allow Speak" })).toBeDisabled();
  expect(screen.getByRole("group", { name: "Create Invite" })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Send Messages" })).not.toBeInTheDocument();
});
it("shows category child synchronization and both child permission types", async () => {
  setup({ ...initial, resource: { name: "Category" }, children: [{ id: "a", name: "synced", synced: true }, { id: "b", name: "independent", synced: false }] }, "categories");
  await screen.findByRole("group", { name: "Send Messages" });
  expect(screen.getByRole("group", { name: "Connect" })).toBeInTheDocument();
  expect(screen.getByText("#independent: Independent overrides")).toBeInTheDocument();
});
it("keeps role and member drafts independent and serializes Neutral as null", async () => {
  const { fetcher } = setup({ ...initial, entries: [{ kind: "role", id: "everyone", permission: "messages.send", state: false }] });
  fireEvent.click(await screen.findByRole("button", { name: "Neutral Send Messages" }));
  fireEvent.click(screen.getByRole("button", { name: "Add Roles or Members" }));
  fireEvent.click(screen.getByRole("button", { name: "Members" }));
  fireEvent.click(await screen.findByRole("button", { name: /Ash.*@ash/ }));
  fireEvent.click(screen.getByRole("button", { name: "Deny Send Messages" }));
  fireEvent.click(screen.getByRole("button", { name: "@everyone" }));
  expect(screen.getByRole("button", { name: "Neutral Send Messages" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(fetcher.mock.calls.some(c => c[1]?.method === "PUT")).toBe(true));
  expect(savedBody(fetcher).changes).toEqual(expect.arrayContaining([{ kind: "role", id: "everyone", permission: "messages.send", state: null }, { kind: "member", id: "member", permission: "messages.send", state: false }]));
});
it("private mode changes only visibility and Reset restores the draft", async () => {
  setup(); fireEvent.click(await screen.findByRole("switch", { name: "Private Channel" }));
  expect(screen.getByRole("button", { name: "Deny View Channel" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Neutral Send Messages" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(screen.getByRole("switch", { name: "Private Channel" })).toHaveAttribute("aria-checked", "false");
  expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
});
it("confirms clearing one target while preserving another target", async () => {
  const { fetcher } = setup({ ...initial, entries: [{ kind: "role", id: "everyone", permission: "messages.send", state: false }, { kind: "member", id: "member", permission: "messages.send", state: true }] });
  fireEvent.click(await screen.findByRole("button", { name: "Clear Permissions" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear Permissions" }));
  fireEvent.click(screen.getByRole("button", { name: "Ash" }));
  expect(screen.getByRole("button", { name: "Allow Send Messages" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(fetcher.mock.calls.some(c => c[1]?.method === "PUT")).toBe(true));
  expect(savedBody(fetcher).changes).toEqual([{ kind: "role", id: "everyone", permission: "messages.send", state: null }]);
});
it("prevents duplicate writes and disables draft changes while saving", async () => {
  let finish!: (response: Response) => void;
  const { fetcher } = setup(initial, "channels", () => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(await screen.findByRole("button", { name: "Allow Send Messages" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(finish).toBeDefined());
  expect(screen.getByRole("button", { name: "Deny Send Messages" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Saving..." }));
  expect(fetcher.mock.calls.filter(c => c[1]?.method === "PUT")).toHaveLength(1);
  await act(async () => { finish(Response.json({ ...initial, version: "v2", entries: [{ kind: "role", id: "everyone", permission: "messages.send", state: true }] })); });
  await screen.findByText("Permissions saved.");
});
it("pins the draft revision when a background refresh changes permissions", async () => {
  const { fetcher, queries } = setup();
  fireEvent.click(await screen.findByRole("button", { name: "Allow Send Messages" }));
  act(() => { queries.setQueryData(["permission-overwrites", "server", "channels", "channel"], parsePermissionSnapshot({ ...initial, version: "external", entries: [{ kind: "role", id: "everyone", permission: "channels.view", state: false }] })); });
  expect(await screen.findByText(/Permissions changed elsewhere/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Allow Send Messages" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(fetcher.mock.calls.some(c => c[1]?.method === "PUT")).toBe(true));
  expect(savedBody(fetcher).version).toBe("v1");
});
it("confirms category sync and sends no independent changes with it", async () => {
  const { fetcher } = setup({ ...initial, resource: { ...initial.resource, category_id: "category", category_name: "Games", sync_with_category: false } });
  fireEvent.click(await screen.findByRole("button", { name: "Allow Send Messages" }));
  fireEvent.click(screen.getByRole("button", { name: "Sync permissions" }));
  expect(fetcher.mock.calls.filter(c => c[1]?.method === "PUT")).toHaveLength(0);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sync permissions" }));
  await waitFor(() => expect(fetcher.mock.calls.some(c => c[1]?.method === "PUT")).toBe(true));
  expect(savedBody(fetcher)).toEqual({ version: "v1", changes: [], sync: true });
});
it("keeps protected targets and ungrantable permissions read-only", async () => {
  setup({ ...initial, grantable: [], roles: initial.roles.map(r => ({ ...r, manageable: false })) });
  expect(await screen.findByRole("button", { name: "Allow Send Messages" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Deny Send Messages" })).toBeDisabled();
});
it("loads the latest revision after a conflict while preserving the draft", async () => {
  const { fetcher } = setup();
  fireEvent.click(await screen.findByRole("button", { name: "Allow Send Messages" }));
  fetcher.mockImplementationOnce(async () => Response.json({}, { status: 409 }));
  fetcher.mockImplementationOnce(async () => Response.json({ ...initial, version: "server-v2" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Your draft is preserved");
  expect(await screen.findByRole("button", { name: "Load latest permissions" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Allow Send Messages" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Load latest permissions" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Discard this draft");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: "Allow Send Messages" })).toHaveAttribute("aria-pressed", "true");
});
