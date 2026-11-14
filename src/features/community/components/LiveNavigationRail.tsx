import { Plus } from "lucide-react";
import { Link } from "react-router";
import { Brand } from "@/components/common/Brand";
import { Tooltip } from "@/components/ui/tooltip";
import { CreateCommunityDialog } from "@/features/community/components/CreateResourceDialog";
import { useCurrentUser } from "@/features/community/api/hooks";
import {
  communityHref,
  useCommunitySelection,
} from "@/features/community/api/use-community-selection";
import { cn } from "@/lib/utils";

export function LiveNavigationRail() {
  const { communityItems, community } = useCommunitySelection();
  const profile = useCurrentUser();
  return (
    <nav className="navigation-rail" aria-label="Communities">
      <Link to="/app" className="rail-logo" aria-label="Core home">
        <Brand markOnly />
      </Link>
      <div className="rail-links">
        {communityItems.map((item) => (
          <Tooltip key={item.id} content={item.name}>
            <Link
              to={communityHref(item.id)}
              aria-label={item.name}
              aria-current={community?.id === item.id ? "page" : undefined}
              className={cn(
                "rail-link",
                community?.id === item.id && "is-active",
              )}
            >
              <span className="text-sm font-semibold" aria-hidden="true">
                {Array.from(item.name).slice(0, 2).join("").toLocaleUpperCase()}
              </span>
            </Link>
          </Tooltip>
        ))}
        <CreateCommunityDialog>
          <button
            className="rail-link rail-add"
            aria-label="Add community"
            disabled={!profile.isSuccess}
          >
            <Plus size={29} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </CreateCommunityDialog>
      </div>
    </nav>
  );
}
