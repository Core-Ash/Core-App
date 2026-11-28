import { Plus } from "lucide-react";
import { Link, useLocation } from "react-router";
import { Brand } from "@/components/common/Brand";
import { Tooltip } from "@/components/ui/tooltip";
import { AddServerDialog } from "@/features/community/components/AddServerDialog";
import { useCurrentUser } from "@/features/community/api/hooks";
import {
  communityHref,
  useCommunitySelection,
} from "@/features/community/api/use-community-selection";
import { cn } from "@/lib/utils";

export function LiveNavigationRail() {
  const { communityItems, community } = useCommunitySelection();
  const profile = useCurrentUser();
  const { pathname } = useLocation();
  const personal = pathname === "/app/friends" || pathname === "/app/messages";
  return (
    <nav className="navigation-rail" aria-label="Communities">
      <Link
        to="/app/friends"
        className={cn("rail-logo", personal && "is-active")}
        aria-label="Core Home"
        title="Friends and direct messages"
        aria-current={personal ? "page" : undefined}
        onKeyDown={(event) => {
          if (event.key !== " ") return;
          event.preventDefault();
          if (!event.repeat) event.currentTarget.click();
        }}
      >
        <div className="rail-logo-surface">
          <Brand markOnly />
        </div>
      </Link>
      <div className="rail-links">
        {communityItems.map((item) => (
          <Tooltip key={item.id} content={item.name}>
            <Link
              to={communityHref(item.id)}
              aria-label={item.name}
              aria-current={!personal && community?.id === item.id ? "page" : undefined}
              className={cn(
                "rail-link",
                !personal && community?.id === item.id && "is-active",
              )}
            >
              <span className="text-sm font-semibold" aria-hidden="true">
                {Array.from(item.name).slice(0, 2).join("").toLocaleUpperCase()}
              </span>
            </Link>
          </Tooltip>
        ))}
        <AddServerDialog>
          <button
            className="rail-link rail-add"
            aria-label="Add server"
            disabled={!profile.isSuccess}
          >
            <Plus size={29} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </AddServerDialog>
      </div>
    </nav>
  );
}
