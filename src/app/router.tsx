import { Route, Routes } from "react-router";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { GuestRoute } from "@/features/auth/GuestRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { SessionRedirect } from "@/features/auth/SessionRedirect";
import { MessagesPage } from "@/features/messages/MessagesPage";
import { CommunityPage } from "@/features/community/CommunityPage";
import { InvitePage } from "@/features/invites/InvitePage";
import { FriendsPage } from "@/features/friends/FriendsPage";

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
            element={<MessagesPage />}
          />
          <Route
            path="/app/messages/:conversationId"
            element={<MessagesPage />}
          />
          <Route
            path="/app/friends"
            element={<FriendsPage />}
          />
          <Route path="/app/settings" element={<CommunityPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
