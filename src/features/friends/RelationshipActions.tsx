import { Button } from "@/components/ui/button";
import { useFriendAction, useRelationship } from "@/features/friends/api";
import { apiErrorMessage } from "@/lib/api/errors";
import { fullUsername } from "@/lib/display-name";
import type { PublicProfile } from "@/lib/api/types";

export function RelationshipActions({ profile }: { profile: PublicProfile }) {
  const relationship = useRelationship(profile.id);
  const mutation = useFriendAction();
  if (relationship.isPending) return <p role="status" className="text-xs text-muted-foreground">Loading relationship…</p>;
  if (relationship.error) return <div><p role="alert">{apiErrorMessage(relationship.error)}</p><Button variant="ghost" size="sm" onClick={() => void relationship.refetch()}>Retry</Button></div>;
  const { state, request_id } = relationship.data;
  if (state === "self") return null;
  const tag = fullUsername(profile);
  return <div className="space-y-2" aria-busy={mutation.isPending}>
    <div className="flex flex-wrap gap-2">
      {state === "none" && tag && <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "send", username: tag })}>Add Friend</Button>}
      {state === "incoming" && request_id && <>
        <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "accept", id: request_id })}>Accept</Button>
        <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "decline", id: request_id })}>Decline</Button>
      </>}
      {state === "outgoing" && request_id && <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "cancel", id: request_id })}>Cancel Request</Button>}
      {state === "friends" && <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "remove", id: profile.id })}>Remove Friend</Button>}
      <Button size="sm" variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: state === "blocked" ? "unblock" : "block", id: profile.id })}>{state === "blocked" ? "Unblock" : "Block User"}</Button>
    </div>
    {mutation.isPending && <p role="status" className="text-xs">Updating relationship…</p>}
    {mutation.error && <p role="alert" className="text-xs text-destructive">{apiErrorMessage(mutation.error)}</p>}
  </div>;
}
