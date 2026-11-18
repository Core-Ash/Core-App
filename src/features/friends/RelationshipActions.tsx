import { Button } from "@/components/ui/button";
import { useFriendAction, useRelationship, type FriendAction } from "@/features/friends/api";
import { apiErrorMessage } from "@/lib/api/errors";
import { fullUsername } from "@/lib/display-name";
import type { PublicProfile } from "@/lib/api/types";

export function RelationshipActions({ profile, menu = false, onComplete }: { profile: PublicProfile; menu?: boolean; onComplete?: () => void }) {
  const relationship = useRelationship(profile.id);
  const mutation = useFriendAction();

  function act(input: FriendAction) { mutation.mutate(input, { onSuccess: onComplete }); }

  if (relationship.isPending)
    return (
      <p role="status" className="text-xs text-muted-foreground">
        Loading relationship…
      </p>
    );
  if (relationship.error)
    return (
      <div>
        <p role="alert">{apiErrorMessage(relationship.error)}</p>
        <Button
            role={menu ? "menuitem" : undefined}
          variant="ghost"
          size="sm"
          onClick={() => void relationship.refetch()}
        >
          Retry
        </Button>
      </div>
    );

  const { state, request_id } = relationship.data;
  if (state === "self") return null;
  const tag = fullUsername(profile);

  return (
    <div className="space-y-2" aria-busy={mutation.isPending}>
      <div className={menu ? "dm-user-menu-relationships" : "flex flex-wrap gap-2"}>
        {state === "none" && tag && (
          <Button
            role={menu ? "menuitem" : undefined}
            size="sm"
            disabled={mutation.isPending}
            onClick={() => act({ action: "send", username: tag })}
          >
            Add Friend
          </Button>
        )}
        {state === "incoming" && request_id && (
          <>
            <Button
            role={menu ? "menuitem" : undefined}
              size="sm"
              disabled={mutation.isPending}
              onClick={() =>
                act({ action: "accept", id: request_id })
              }
            >
              Accept
            </Button>
            <Button
            role={menu ? "menuitem" : undefined}
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() =>
                act({ action: "decline", id: request_id })
              }
            >
              Decline
            </Button>
          </>
        )}
        {state === "outgoing" && request_id && (
          <Button
            role={menu ? "menuitem" : undefined}
            size="sm"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() =>
              act({ action: "cancel", id: request_id })
            }
          >
            Cancel Request
          </Button>
        )}
        {state === "friends" && (
          <>
            <Button
            role={menu ? "menuitem" : undefined}
              data-destructive={menu ? "true" : undefined}
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() =>
                act({ action: "remove", id: profile.id })
              }
            >
              Remove Friend
            </Button>
          </>
        )}
        <Button
            role={menu ? "menuitem" : undefined}
          data-destructive={menu && state !== "blocked" ? "true" : undefined}
          size="sm"
          variant="ghost"
          disabled={mutation.isPending}
          onClick={() =>
            act({
              action: state === "blocked" ? "unblock" : "block",
              id: profile.id,
            })
          }
        >
          {state === "blocked" ? "Unblock" : "Block User"}
        </Button>
      </div>
      {mutation.isPending && (
        <p role="status" className="text-xs">
          Updating relationship…
        </p>
      )}
      {mutation.error && (
        <p role="alert" className="text-xs text-destructive">
          {apiErrorMessage(mutation.error)}
        </p>
      )}
    </div>
  );
}
