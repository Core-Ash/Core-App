import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataProvider } from "@/app/AppDataProvider";
import { AuthContext } from "@/features/auth/auth-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { NavigationRail } from "@/components/layout/NavigationRail";
import { CommunityPage } from "@/features/community/CommunityPage";
import {
  communityFixture,
  channelFixture,
  profileFixture,
  messageFixture,
  memberPageFixture,
} from "@/test/api-fixtures";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";
import type { Message } from "@/lib/api/types";
import { queryKeys } from "@/features/community/api/hooks";

vi.mock("@/lib/env", () => ({
  apiConfiguration: { url: "/api/v1", configured: true, error: null },
}));
afterEach(() => vi.unstubAllGlobals());

function QueryCapture({ capture }: { capture: (client: QueryClient) => void }) {
  const client = useQueryClient();
  useEffect(() => capture(client), [capture, client]);
  return null;
}

async function openServerSettings() {
  const menu = await screen.findByLabelText(`Server menu, ${communityFixture.name}`);
  fireEvent.click(menu);
  fireEvent.click(screen.getByRole("link", { name: "Server Settings" }));
}

function setup({ noCommunities = false, noProfile = false, noChannels = false, owner = true } = {}) {
  let queries!: QueryClient;
  const communities = noCommunities ? [] : [communityFixture];
  const channels = noChannels ? [] : [channelFixture];
  if (!owner) communities[0] = { ...communityFixture, owner_id: "99999999-9999-4999-8999-999999999999" };
  const messages: Message[] = [messageFixture];
  let profileCreated = !noProfile;
  const request = vi.fn(async (input: string, options: RequestInit = {}) => {
    const url = new URL(input, "https://core.example.com");
    const write = options.method === "POST";
    if (url.pathname === "/api/v1/bootstrap")
      return profileCreated
        ? Response.json({ profile: profileFixture, communities: { items: [...communities] } })
        : new Response(null, { status: 409 });
    if (url.pathname === "/api/v1/me") {
      if (write) profileCreated = true;
      return profileCreated
        ? Response.json(profileFixture)
        : new Response(null, { status: 409 });
    }
    if (url.pathname === "/api/v1/communities") {
      if (write) {
        communities.push(communityFixture);
        return Response.json(communityFixture, { status: 201 });
      }
      return Response.json({ items: [...communities] });
    }
    if (url.pathname === `/api/v1/communities/${communityFixture.id}/members` && write)
      return new Response(null, { status: 201 });
    if (url.pathname.endsWith("/members"))
      return Response.json({ ...memberPageFixture, channel_id: url.pathname.includes("/channels/") ? channelFixture.id : null });
    if (
      url.pathname === `/api/v1/communities/${communityFixture.id}/channels`
    ) {
      if (write) {
        const name = (JSON.parse(String(options.body)) as { name: string })
          .name;
        const channel = {
          ...channelFixture,
          id: "66666666-6666-4666-8666-666666666666",
          name,
        };
        channels.push(channel);
        return Response.json(channel, { status: 201 });
      }
      return Response.json({ items: [...channels] });
    }
    if (/^\/api\/v1\/channels\/[^/]+\/messages$/.test(url.pathname))
      return Response.json({ items: [...messages], next_cursor: null });
    throw new Error("Unexpected fixture route");
  });
  vi.stubGlobal("fetch", request);
  render(
    <AuthContext.Provider
      value={{ ...signedOutState, session: sessionFixture }}
    >
      <AppDataProvider>
        <QueryCapture capture={(client) => { queries = client; }} />
        <MemoryRouter initialEntries={["/app"]}>
          <NavigationRail />
          <AppSidebar />
          <Routes>
            <Route path="/app" element={<CommunityPage />} />
          </Routes>
        </MemoryRouter>
      </AppDataProvider>
    </AuthContext.Provider>,
  );
  return { request, messages, communities, channels, get queries() { return queries; } };
}

describe("Rust-backed community workspace", () => {
  it("collapses categories independently and opens creation without changing expansion", async () => {
    setup();
    const category = await screen.findByRole("region", { name: "Text Channels" });
    const toggle = within(category).getByRole("button", { name: "Text Channels" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "general" })).not.toBeInTheDocument();
    const create = within(category).getByRole("button", { name: "Create Channel" });
    fireEvent.click(create);
    expect(screen.getByRole("dialog", { name: "Create a channel" })).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(create).toHaveFocus());
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "general" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voice Channels" })).toHaveAttribute("aria-expanded", "true");
  });
  it("keeps privileged creation and admission controls hidden from regular members", async () => {
    setup({ owner: false });
    await screen.findByText(messageFixture.body!);
    expect(screen.queryByRole("button", { name: /Create Channel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
    await openServerSettings();
    expect(screen.getByText("Server name, icon, and banner editing are unavailable.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Members" }));
    expect(screen.queryByRole("form", { name: "Add community member" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Back to channels" }));
    expect(await screen.findByRole("heading", { name: "general" })).toBeInTheDocument();
  });
  it("automatically loads and toggles the channel member sidebar on wide layouts", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const { request } = setup();
    const sidebar = await screen.findByRole("complementary", { name: "Community members" });
    expect(await within(sidebar).findByRole("button", { name: `View profile for ${profileFixture.display_name}` })).toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url.includes(`/channels/${channelFixture.id}/members?`))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Hide members" }));
    expect(screen.queryByRole("complementary", { name: "Community members" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show members" }));
    expect(await screen.findByRole("complementary", { name: "Community members" })).toBeInTheDocument();
  });
  it("renders another author's resolved public profile without fetching individual users", async () => {
    const { request, messages } = setup();
    const id = "99999999-9999-4999-8999-999999999999";
    messages[0] = { ...messageFixture, author_id: id, author: { id, display_name: "Visiting Gamer", username: "visiting_gamer", avatar_url: null } };
    fireEvent.click(await screen.findByRole("button", { name: "View profile for Visiting Gamer" }));
    const card = screen.getByRole("dialog", { name: "Visiting Gamer" });
    expect(within(card).getByText("@visiting_gamer")).toBeInTheDocument();
    expect(within(card).queryByText(id)).not.toBeInTheDocument();
    expect(request.mock.calls.some(([url]) => url.includes("/users/"))).toBe(false);
  });
  it("lets an admitted user refresh an empty community list without signing in again", async () => {
    const { communities, request } = setup({ noCommunities: true });
    const refresh = await screen.findByRole("button", { name: "Refresh communities" });
    communities.push(communityFixture);
    fireEvent.click(refresh);
    expect(await screen.findByText(messageFixture.body!)).toBeInTheDocument();
    expect(request.mock.calls.filter(([url]) => url === "/api/v1/communities")).toHaveLength(1);
    expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });
  it("adds a member to a community without channels, preserving input on denial and blocking duplicate submits", async () => {
    const { request } = setup({ noChannels: true });
    await openServerSettings();
    fireEvent.click(screen.getByRole("link", { name: "Members" }));
    const form = screen.getByRole("form", { name: "Add community member" });
    const input = within(form).getByLabelText("Member reference");
    expect(input).toHaveAttribute("type", "password");
    fireEvent.change(input, { target: { value: "not a uuid" } });
    fireEvent.submit(form);
    expect(within(form).getByRole("alert")).toHaveTextContent("valid member reference");
    expect(request.mock.calls.filter(([url, options]) => url.endsWith("/members") && options?.method === "POST")).toHaveLength(0);

    const original = request.getMockImplementation()!;
    let finish!: (response: Response) => void;
    request.mockImplementation((url, options) => url.endsWith("/members") && options?.method === "POST"
      ? new Promise<Response>((resolve) => { finish = resolve; })
      : original(url, options));
    const target = "88888888-8888-4888-8888-888888888888";
    fireEvent.change(input, { target: { value: target } });
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(finish).toBeDefined());
    expect(within(form).getByRole("button", { name: "Adding member…" })).toBeDisabled();
    expect(request.mock.calls.filter(([url, options]) => url.endsWith("/members") && options?.method === "POST")).toHaveLength(1);
    await act(async () => { finish(new Response(null, { status: 403 })); });
    expect(await within(form).findByRole("alert")).toHaveTextContent("don't have permission");
    expect(input).toHaveValue(target);
    expect(within(form).getByRole("status")).not.toHaveTextContent("Member added");
    fireEvent.submit(form);
    await waitFor(() => expect(request.mock.calls.filter(([url, options]) => url.endsWith("/members") && options?.method === "POST")).toHaveLength(2));
    await act(async () => { finish(new Response(null, { status: 201 })); });
    await waitFor(() => expect(within(form).getByRole("status")).toHaveTextContent("Member added"));
    expect(input).toHaveValue("");
    const membershipWrites = request.mock.calls.filter(([url, options]) => url.endsWith("/members") && options?.method === "POST");
    expect(membershipWrites[1]![1]).toMatchObject({
      method: "POST", credentials: "include", body: JSON.stringify({ user_id: target }),
      headers: expect.objectContaining({ "X-Core-CSRF": "1" }),
    });
    expect(request.mock.calls.some(([url]) => url.includes("/messages"))).toBe(false);
  });
  it("shows the member directory limitation without owner controls for other members", async () => {
    setup({ owner: false });
    await openServerSettings();
    fireEvent.click(screen.getByRole("link", { name: "Members" }));
    expect(screen.getByRole("heading", { name: "Community members" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Add community member" })).not.toBeInTheDocument();
  });
  it("renders the Rust profile and real history without mixing in sample identities", async () => {
    const { request } = setup();
    expect(await screen.findByText(messageFixture.body!)).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Signed-in account" }),
      ).getByText(profileFixture.display_name),
    ).toBeInTheDocument();
    expect(screen.queryByText("Alex Morgan")).not.toBeInTheDocument();
    expect(screen.queryByText("Nex")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Design preview · sample/),
    ).not.toBeInTheDocument();
    expect(
      request.mock.calls.filter(([url]) => url === "/api/v1/bootstrap"),
    ).toHaveLength(1);
    expect(request.mock.calls.some(([url]) => url === "/api/v1/communities")).toBe(false);
    expect(
      screen.getByRole("button", { name: "Voice unavailable" }),
    ).toBeDisabled();
  });
  it("shows message loading and empty history states", async () => {
    const { request } = setup();
    let finish!: (response: Response) => void;
    const original = request.getMockImplementation()!;
    request.mockImplementation((input, options) =>
      input.includes("/messages")
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : original(input, options),
    );
    expect(
      await screen.findByText("Loading message history…"),
    ).toBeInTheDocument();
    await act(async () => {
      finish(Response.json({ items: [], next_cursor: null }));
    });
    expect(
      await screen.findByRole("heading", { name: "A little quiet in here." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Message #general" }),
    ).toBeInTheDocument();
  });
  it("requires an explicit onboarding POST before fetching application resources", async () => {
    const { request } = setup({ noProfile: true });
    fireEvent.click(
      await screen.findByRole("button", { name: "Set up profile" }),
    );
    await screen.findByText(messageFixture.body!);
    const calls = request.mock.calls;
    const writes = calls.filter(
      ([url, options]) => url === "/api/v1/me" && options?.method === "POST",
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]![1]?.body).toBe("{}");
    expect(
      calls.findIndex(([url]) => url === "/api/v1/communities"),
    ).toBeGreaterThan(calls.indexOf(writes[0]!));
  });
  it("shows a pending send immediately and replaces it with the confirmed message without a history GET", async () => {
    const { request } = setup();
    const original = request.getMockImplementation()!;
    let finish!: (response: Response) => void;
    let payload!: { body: string; client_nonce: string };
    request.mockImplementation((input, options) => {
      if (input.includes("/messages") && options?.method === "POST") {
        payload = JSON.parse(String(options.body)) as typeof payload;
        return new Promise<Response>((resolve) => { finish = resolve; });
      }
      return original(input, options);
    });
    const draft = await screen.findByRole("textbox", { name: "Message #general" });
    fireEvent.change(draft, { target: { value: "Fast feedback" } });
    fireEvent.keyDown(draft, { key: "Enter" });
    expect(await screen.findByRole("status", { name: "Pending message" })).toHaveTextContent("Fast feedback");
    expect(draft).toHaveValue("Fast feedback");
    await waitFor(() => expect(finish).toBeDefined());
    await act(async () => {
      finish(Response.json({ ...messageFixture, id: "77777777-7777-4777-8777-777777777777", ...payload }));
    });
    await waitFor(() => expect(draft).toHaveValue(""));
    expect(screen.queryByRole("status", { name: "Pending message" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Fast feedback")).toHaveLength(1);
    expect(request.mock.calls.filter(([url, options]) => url.includes("/messages") && options?.method !== "POST")).toHaveLength(1);
  });
  it("keeps confirmation when an older background refresh completes after the send", async () => {
    const { request, queries } = setup();
    const original = request.getMockImplementation()!;
    const draft = await screen.findByRole("textbox", { name: "Message #general" });
    let finishSend!: (response: Response) => void;
    let finishRead!: (response: Response) => void;
    let payload!: { body: string; client_nonce: string };
    let readSignal!: AbortSignal;
    request.mockImplementation((input, options) => {
      if (!input.includes("/messages")) return original(input, options);
      if (options?.method === "POST") {
        payload = JSON.parse(String(options.body)) as typeof payload;
        return new Promise<Response>((resolve) => { finishSend = resolve; });
      }
      readSignal = options?.signal as AbortSignal;
      return new Promise<Response>((resolve) => { finishRead = resolve; });
    });
    fireEvent.change(draft, { target: { value: "Keep confirmation" } });
    fireEvent.keyDown(draft, { key: "Enter" });
    await waitFor(() => expect(finishSend).toBeDefined());
    await act(async () => { void queries.invalidateQueries({ queryKey: queryKeys.messages(channelFixture.id) }); });
    await waitFor(() => expect(finishRead).toBeDefined());
    await act(async () => {
      finishSend(Response.json({ ...messageFixture, id: "77777777-7777-4777-8777-777777777777", ...payload }));
    });
    await waitFor(() => expect(draft).toHaveValue(""));
    expect(readSignal.aborted).toBe(true);
    await act(async () => {
      finishRead(Response.json({ items: [messageFixture], next_cursor: null }));
    });
    expect(screen.getAllByText("Keep confirmation")).toHaveLength(1);
  });
  it("keeps a failed draft and reuses its nonce after a lost send response", async () => {
    const { request, messages } = setup();
    const original = request.getMockImplementation()!;
    const sent: { body: string; client_nonce: string }[] = [];
    request.mockImplementation(async (input, options) => {
      if (input.includes("/messages") && options?.method === "POST") {
        const payload = JSON.parse(String(options.body)) as {
          body: string;
          client_nonce: string;
        };
        sent.push(payload);
        if (sent.length === 1) {
          messages.unshift({
            ...messageFixture,
            id: "77777777-7777-4777-8777-777777777777",
            ...payload,
            created_at: "2026-11-15T10:01:00+00:00",
          });
          throw new TypeError("Response lost after insert");
        }
        return Response.json(messages[0]);
      }
      return original(input, options);
    });
    const draft = await screen.findByRole("textbox", {
      name: "Message #general",
    });
    fireEvent.change(draft, { target: { value: "Saved exactly once" } });
    fireEvent.keyDown(draft, { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your draft has been kept",
    );
    expect(draft).toHaveValue("Saved exactly once");
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(draft).toHaveValue(""));
    expect(sent).toHaveLength(2);
    expect(sent[0]).toEqual(sent[1]);
    expect(Object.keys(sent[0]!).sort()).toEqual(["body", "client_nonce"]);
    expect(screen.getAllByText("Saved exactly once")).toHaveLength(1);
    expect(request.mock.calls.filter(([url, options]) =>
      url.includes("/messages") && options?.method !== "POST")).toHaveLength(1);
  });
  it("loads older history using both encoded cursor fields and keeps chronological order", async () => {
    const { request } = setup();
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (input, options) => {
      if (input.includes("/messages")) {
        const url = new URL(input, "https://core.example.com");
        return url.searchParams.has("before_id")
          ? Response.json({
              items: [
                {
                  ...messageFixture,
                  id: "88888888-8888-4888-8888-888888888888",
                  body: "An older message",
                  created_at: "2026-11-15T09:00:00+00:00",
                },
              ],
              next_cursor: null,
            })
          : Response.json({
              items: [messageFixture],
              next_cursor: {
                before_time: messageFixture.created_at,
                before_id: messageFixture.id,
              },
            });
      }
      return original(input, options);
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Load older messages" }),
    );
    await screen.findByText("An older message");
    const items = within(
      screen.getByRole("list", { name: "Messages" }),
    ).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("An older message");
    expect(items[1]).toHaveTextContent(messageFixture.body!);
    expect(
      request.mock.calls.some(
        ([url]) =>
          url.includes(`before_id=${messageFixture.id}`) &&
          url.includes("before_time=2026-11-15T10%3A00%3A00%2B00%3A00"),
      ),
    ).toBe(true);
  });
  it("creates a community and channel using the supported contracts and selects the results", async () => {
    const { request } = setup({ noCommunities: true });
    fireEvent.click(
      await screen.findByRole("button", { name: "Create community" }),
    );
    let dialog = screen.getByRole("dialog", { name: "Create a community" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), {
      target: { value: "Test Squad" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create community" }),
    );
    await screen.findByText(messageFixture.body!);
    fireEvent.click(within(screen.getByRole("region", { name: "Text Channels" })).getByRole("button", { name: "Create Channel" }));
    dialog = screen.getByRole("dialog", { name: "Create a channel" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), {
      target: { value: "tactics" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create channel" }),
    );
    expect(
      await screen.findByRole("heading", { name: "tactics" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "tactics" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      request.mock.calls
        .filter(([, options]) => options?.method === "POST")
        .map(([, options]) => JSON.parse(String(options?.body))),
    ).toEqual([{ name: "Test Squad" }, { name: "tactics" }]);
  });
  it("displays permission errors without displaying sample history or signing out", async () => {
    const { request } = setup();
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (input, options) =>
      input.includes("/messages")
        ? new Response(null, { status: 403 })
        : original(input, options),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "don't have permission",
    );
    expect(screen.queryByText(messageFixture.body!)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Message #general" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Signed-in account" }),
    ).toBeInTheDocument();
  });
  it("renders untrusted HTML as text, handles missing author profiles, and loads visible members", async () => {
    const { messages } = setup();
    messages[0] = {
      ...messageFixture,
      author_id: "99999999-9999-4999-8999-999999999999",
      author: null,
      body: '<img src="x" onerror="alert(1)" />',
    };
    const body = await screen.findByText('<img src="x" onerror="alert(1)" />');
    expect(body.querySelector("img")).toBeNull();
    expect(screen.getByText("Unknown User")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("99999999");
    expect(document.querySelector('[title="99999999-9999-4999-8999-999999999999"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show members" }));
    expect(
      await screen.findByRole("button", { name: `View profile for ${profileFixture.display_name}` }),
    ).toBeInTheDocument();
  });
});
