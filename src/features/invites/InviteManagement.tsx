import { Button } from "@/components/ui/button";
import { ApiNotice } from "@/components/common/ApiNotice";
import { InviteDialog } from "@/features/invites/InviteDialog";
import { useInvitePermissions, useInvites, useRevokeInvite } from "@/features/invites/api";
import type { Community } from "@/lib/api/types";

export function InviteManagement({ community }: { community: Community }) {
  const permissions = useInvitePermissions(community.id), list = useInvites(community.id, permissions.isSuccess && permissions.data.manage), revoke = useRevokeInvite(community.id);
  return <section className="p-6 space-y-5" aria-label="Server invitations">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Invites</h2>
      {permissions.isSuccess && permissions.data.create && <InviteDialog community={community}><Button>Generate Invite Link</Button></InviteDialog>}
    </div>
    {permissions.isPending && <p role="status">Checking permissions…</p>}
    {permissions.error && <ApiNotice error={permissions.error} onRetry={() => { void permissions.refetch(); }} />}
    {permissions.isSuccess && !permissions.data.manage && <p>You don't have permission to manage this server's invitations.</p>}
    {permissions.isSuccess && permissions.data.manage && <>
      {list.isPending && <p role="status">Loading invitations…</p>}
      {list.error && <ApiNotice error={list.error} onRetry={() => { void list.refetch(); }} />}
      {revoke.error && <ApiNotice error={revoke.error} />}
      {list.isSuccess && (list.data.pages.some((page) => page.items.length) ? <div className="overflow-x-auto"><table className="invite-table">
        <caption className="sr-only">Invitation creators, dates, usage, and status</caption>
        <thead><tr>{["Creator", "Created", "Uses", "Expires", "Status", "Action"].map((title) => <th key={title} scope="col">{title}</th>)}</tr></thead>
        <tbody>{list.data.pages.flatMap((page) => page.items).map((invite) => <tr key={invite.id}>
          <td>{invite.creator}</td><td>{new Date(invite.created_at).toLocaleString()}</td><td>{invite.uses} / {invite.max_uses ?? "∞"}</td>
          <td>{invite.expires_at ? new Date(invite.expires_at).toLocaleString() : "Never"}</td><td>{invite.status}</td>
          <td>{invite.status === "active" && <Button variant="outline" disabled={revoke.isPending} aria-label={`Revoke invitation by ${invite.creator}, created ${new Date(invite.created_at).toLocaleString()}`} onClick={() => revoke.mutate(invite.id)}>Revoke</Button>}</td>
        </tr>)}</tbody>
      </table></div> : <p className="text-muted-foreground">No invitation links yet.</p>)}
      {list.hasNextPage && <Button variant="outline" disabled={list.isFetchingNextPage} onClick={() => { void list.fetchNextPage(); }}>{list.isFetchingNextPage ? "Loading…" : "Load more invitations"}</Button>}
    </>}
  </section>;
}
