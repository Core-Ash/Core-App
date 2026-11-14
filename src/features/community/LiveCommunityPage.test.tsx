import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
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
} from "@/test/api-fixtures";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";
import type { Message } from "@/lib/api/types";

vi.mock("@/lib/env", () => ({
  apiConfiguration: { url: "/api/v1", configured: true, error: null },
}));
afterEach(() => vi.unstubAllGlobals());

function setup({ noCommunities = false, noProfile = false } = {}) {
  const communities = noCommunities ? [] : [communityFixture];
  const channels = [channelFixture];
  const messages: Message[] = [messageFixture];
  let profileCreated = !noProfile;
  const request = vi.fn(async (input: string, options: RequestInit = {}) => {
    const url = new URL(input, "https://core.example.com");
    const write = options.method === "POST";
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
  return { request, messages, communities, channels };
}

describe("Rust-backed community workspace", () => {
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
      request.mock.calls.filter(([url]) => url === "/api/v1/me"),
    ).toHaveLength(1);
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
    fireEvent.click(screen.getByRole("button", { name: "Create channel" }));
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
  it("renders untrusted HTML as text and identifies authors with no profile endpoint", async () => {
    const { messages } = setup();
    messages[0] = {
      ...messageFixture,
      author_id: "99999999-9999-4999-8999-999999999999",
      body: '<img src="x" onerror="alert(1)" />',
    };
    const body = await screen.findByText('<img src="x" onerror="alert(1)" />');
    expect(body.querySelector("img")).toBeNull();
    expect(screen.getByText("Member 99999999")).toHaveAttribute(
      "title",
      "99999999-9999-4999-8999-999999999999",
    );
    fireEvent.click(screen.getByRole("button", { name: "Show members" }));
    expect(
      screen.getByRole("heading", { name: "Member profiles unavailable" }),
    ).toBeInTheDocument();
  });
});
