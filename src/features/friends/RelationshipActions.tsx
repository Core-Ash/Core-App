import type { ComponentProps } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Ban, Check, RotateCcw, UserMinus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFriendAction, useRelationship, type FriendAction } from "@/features/friends/api";
import { apiErrorMessage } from "@/lib/api/errors";
import { fullUsername } from "@/lib/display-name";
import type { PublicProfile } from "@/lib/api/types";

function ActionButton({ dropdown, ...props }: ComponentProps<typeof Button> & { dropdown?: boolean }) {
  const button = <Button {...props} />;
  // Keep async actions open until success; failures stay visible with a retry.
  return dropdown ? <DropdownMenu.Item asChild disabled={props.disabled} onSelect={(event) => event.preventDefault()}>{button}</DropdownMenu.Item> : button;
}

export function RelationshipActions({ profile, menu = false, dropdown = false, onComplete }: {
  profile: PublicProfile; menu?: boolean; dropdown?: boolean; onComplete?: () => void;
}) {
  const relationship = useRelationship(profile.id);
  const mutation = useFriendAction();
  if (relationship.isPending) return <p role="status" className="text-xs text-muted-foreground">Loading relationship...</p>;
  if (relationship.error) return <div>
    <p role="alert">{apiErrorMessage(relationship.error)}</p>
    <ActionButton dropdown={dropdown} role={menu ? "menuitem" : undefined} variant="ghost" size="sm" onClick={() => void relationship.refetch()}>Retry</ActionButton>
  </div>;

  const { state, request_id } = relationship.data;
  if (state === "self") return null;
  const tag = fullUsername(profile);
  const actions: { label: string; input: FriendAction; icon: typeof UserPlus; tone?: "remove" | "danger"; variant?: "outline" | "ghost" }[] = [];
  if (state === "none" && tag) actions.push({ label: "Add Friend", input: { action: "send", username: tag }, icon: UserPlus });
  if (state === "incoming" && request_id) actions.push(
    { label: "Accept", input: { action: "accept", id: request_id }, icon: Check },
    { label: "Decline", input: { action: "decline", id: request_id }, icon: X, variant: "outline" },
  );
  if (state === "outgoing" && request_id) actions.push({ label: "Cancel Request", input: { action: "cancel", id: request_id }, icon: X, variant: "outline" });
  if (state === "friends") actions.push({ label: "Remove Friend", input: { action: "remove", id: profile.id }, icon: UserMinus, tone: "remove", variant: "outline" });
  actions.push({ label: state === "blocked" ? "Unblock" : "Block User", input: { action: state === "blocked" ? "unblock" : "block", id: profile.id }, icon: state === "blocked" ? RotateCcw : Ban, tone: state === "blocked" ? undefined : "danger", variant: "ghost" });

  return <div aria-busy={mutation.isPending}>
    <div className={menu ? "user-action-list" : "flex flex-wrap gap-2"}>
      {actions.map(({ label, input, icon: Icon, tone, variant }) => <ActionButton
        key={input.action} dropdown={dropdown} role={menu ? "menuitem" : undefined}
        className={menu ? "user-action-item" : undefined} data-tone={menu ? tone : undefined}
        data-destructive={menu && tone ? "true" : undefined} size="sm" variant={variant}
        disabled={mutation.isPending} onClick={() => mutation.mutate(input, { onSuccess: onComplete })}
      >{menu && <Icon size={18} aria-hidden="true" />}{label}</ActionButton>)}
    </div>
    {mutation.isPending && <p role="status" className="text-xs">Updating relationship...</p>}
    {mutation.error && <p role="alert" className="text-xs text-destructive">{apiErrorMessage(mutation.error)}</p>}
  </div>;
}
