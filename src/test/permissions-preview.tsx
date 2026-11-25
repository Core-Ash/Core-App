// Standalone visual test fixture; excluded from the application's entry point.
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppDataContext } from "@/app/app-data-context";
import { createApiClient } from "@/lib/api/client";
import { ChannelSettings } from "@/features/community/access/ChannelSettings";
import { PERMISSIONS } from "@/features/community/permissions/registry";
import { channelFixture, communityFixture } from "@/test/api-fixtures";
import "@/styles/globals.css";

const snapshot = {
  version: "visual-fixture", resource: { name: "general", kind: "text", category_id: "games", category_name: "Games", sync_with_category: true },
  grantable: PERMISSIONS.filter(p => p.status === "enforced").map(p => p.key),
  entries: [{ kind: "role", id: "everyone", permission: "channels.view", state: false }, { kind: "role", id: "players", permission: "channels.view", state: true }, { kind: "role", id: "moderators", permission: "messages.send", state: true }],
  roles: [{ id: "everyone", name: "@everyone", color: null, is_default: true, manageable: true }, { id: "players", name: "Players", color: "#43b581", is_default: false, manageable: true }, { id: "moderators", name: "Moderators", color: "#ed4245", is_default: false, manageable: true }],
  members: [{ id: "ash", name: "Ash", username: "ash#1234", avatar_url: null, manageable: true }],
};
globalThis.fetch = async () => Response.json(snapshot);
const api = createApiClient({ baseUrl: "https://permissions.fixture", sessionSignal: () => new AbortController().signal, onUnauthorized: async () => "active" });
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient()}><AppDataContext.Provider value={{ api, ready: true, configured: true, configurationError: null, clearPrivateData: () => {} }}><ChannelSettings community={communityFixture} channel={channelFixture} open /></AppDataContext.Provider></QueryClientProvider>);
