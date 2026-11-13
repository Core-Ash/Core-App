import { Home, MessageCircle, Server, Settings, Users } from "lucide-react";
import { NavLink } from "react-router";
import { Brand } from "@/components/common/Brand";
import { UserAvatar } from "@/components/common/UserAvatar";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { useAuth } from "@/features/auth/auth-context";

const upcomingItems = [
  { label: "Servers", icon: Server },
  { label: "Direct Messages", icon: MessageCircle },
  { label: "Friends", icon: Users },
  { label: "Settings", icon: Settings },
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useAuth();
  if (!session) return null;
  const { user } = session;

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex h-22 shrink-0 items-center px-7">
        <Brand />
      </div>
      <nav
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto px-4 pt-6"
      >
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Your workspace
        </p>
        <NavLink
          to="/app"
          end
          onClick={onNavigate}
          className="flex h-11 items-center gap-3 rounded-lg border border-primary/15 bg-primary/10 px-3 text-sm font-medium text-primary"
        >
          <Home className="size-[18px]" aria-hidden="true" /> Home{" "}
          <span className="ml-auto size-1.5 rounded-full bg-primary" />
        </NavLink>
        <div className="mt-2 space-y-1">
          {upcomingItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              disabled
              className="flex h-11 w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 text-left text-sm text-muted-foreground/75"
            >
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />{" "}
              <span>{label}</span>
              <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground/60">
                Soon
              </span>
            </button>
          ))}
        </div>
      </nav>
      <div className="mx-5 mb-6 rounded-xl border border-border bg-card/50 p-4">
        <p className="text-xs font-medium">Room for what matters.</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Your communities and conversations will find a home here.
        </p>
      </div>
      <div className="shrink-0 border-t border-border p-4">
        <div className="mb-3 flex items-center gap-3 px-2">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={user.name}>
              {user.name || "Core member"}
            </p>
            <p
              className="mt-0.5 truncate text-xs text-muted-foreground"
              title={user.email}
            >
              {user.email}
            </p>
          </div>
        </div>
        <LogoutButton />
      </div>
    </div>
  );
}
