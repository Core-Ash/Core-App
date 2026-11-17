import { Route, Routes } from "react-router";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { GuestRoute } from "@/features/auth/GuestRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { SessionRedirect } from "@/features/auth/SessionRedirect";
import { UnavailablePage } from "@/features/home/UnavailablePage";
import { CommunityPage } from "@/features/community/CommunityPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { InvitePage } from "@/features/invites/InvitePage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SessionRedirect />} />
      <Route path="/invite/:code" element={<InvitePage />} />
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/app" element={<CommunityPage />} />
          <Route path="/app/communities" element={<CommunityPage />} />
          <Route
            path="/app/messages"
            element={<UnavailablePage feature="messages" />}
          />
          <Route
            path="/app/friends"
            element={<UnavailablePage feature="friends" />}
          />
          <Route path="/app/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
