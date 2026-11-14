import { Compass, Plus, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "react-router";
import { Brand } from "@/components/common/Brand";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { CommunityEmblem } from "@/features/community/components/CommunityEmblem";
import { previewCommunities } from "@/features/community/preview/preview-data";
import {
  previewHref,
  usePreviewSelection,
} from "@/features/community/preview/use-preview-selection";
import { cn } from "@/lib/utils";
import { useOptionalAppData } from "@/app/app-data-context";
import { LiveNavigationRail } from "@/features/community/components/LiveNavigationRail";

export function NavigationRail() {
  const data = useOptionalAppData();
  return data?.configured ? <LiveNavigationRail /> : <PreviewNavigationRail />;
}

function PreviewNavigationRail() {
  const { community } = usePreviewSelection();
  return (
    <nav className="navigation-rail" aria-label="Communities">
      <Link to="/app" className="rail-logo" aria-label="Core home">
        <Brand markOnly />
      </Link>
      <div className="rail-links">
        {previewCommunities.map((item) => (
          <Tooltip key={item.id} content={`${item.name} · sample community`}>
            <Link
              to={previewHref(item.id)}
              aria-label={item.name}
              aria-current={community.id === item.id ? "page" : undefined}
              className={cn(
                "rail-link",
                community.id === item.id && "is-active",
              )}
            >
              <CommunityEmblem emblem={item.emblem} />
            </Link>
          </Tooltip>
        ))}
        <Dialog.Root>
          <Tooltip content="Add community">
            <Dialog.Trigger asChild>
              <button className="rail-link rail-add" aria-label="Add community">
                <Plus size={29} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </Dialog.Trigger>
          </Tooltip>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="standard-dialog">
              <Dialog.Title className="sr-only">Add a community</Dialog.Title>
              <Dialog.Description className="sr-only">
                Community creation is not available in this preview.
              </Dialog.Description>
              <EmptyState
                icon={Compass}
                title="A place for your squad."
                description="Community creation isn’t available yet. The communities in this interface are examples for the design preview."
              >
                <Dialog.Close asChild>
                  <Button asChild>
                    <Link to="/app">Back to Core Gaming</Link>
                  </Button>
                </Dialog.Close>
              </EmptyState>
              <Dialog.Close asChild>
                <button className="icon-button dialog-close" aria-label="Close">
                  <X size={20} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </nav>
  );
}
