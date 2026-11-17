import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataProvider } from "@/app/AppDataProvider";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { NavigationRail } from "@/components/layout/NavigationRail";
import { AuthContext } from "@/features/auth/auth-context";
import { sessionFixture, signedOutState } from "@/test/auth-fixture";
import { CommunityPage } from "@/features/community/CommunityPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

vi.mock("@/lib/env", () => ({
  apiConfiguration: { url: null, configured: false, error: "API URL missing" },
}));
afterEach(() => vi.unstubAllGlobals());

describe("workspace configuration", () => {
  it.each(["/app", "/app/communities", "/app/settings"])(
    "shows a configuration error without simulated data or network requests at %s", (path) => {
      const request = vi.fn();
      vi.stubGlobal("fetch", request);
      render(
        <AuthContext.Provider value={{ ...signedOutState, session: sessionFixture }}>
          <AppDataProvider>
            <MemoryRouter initialEntries={[path]}>
              <NavigationRail />
              <AppSidebar />
              <Routes>
                <Route path="/app" element={<CommunityPage />} />
                <Route path="/app/communities" element={<CommunityPage />} />
                <Route path="/app/settings" element={<SettingsPage />} />
              </Routes>
            </MemoryRouter>
          </AppDataProvider>
        </AuthContext.Provider>,
      );
      expect(screen.getByRole("alert")).toHaveTextContent("application service is not configured");
      expect(screen.queryByRole("list", { name: "Messages" })).not.toBeInTheDocument();
      expect(screen.queryByText("Nex")).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add server" })).toBeDisabled();
      expect(request).not.toHaveBeenCalled();
    },
  );
});
