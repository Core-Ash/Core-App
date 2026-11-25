import { useInvitePermissions } from "@/features/invites/api";
import { InviteDialog } from "@/features/invites/InviteDialog";
import { ApiNotice } from "@/components/common/ApiNotice";
import { Button } from "@/components/ui/button";
import type { Channel, Community } from "@/lib/api/types";

export function ChannelInviteSettings({ community, channel }: { community: Community; channel: Channel }) {
  const permissions = useInvitePermissions(community.id, channel.id);
  if (permissions.isError) return <ApiNotice error={permissions.error} onRetry={() => { void permissions.refetch(); }} />;
  return <section className="space-y-4"><h2 className="text-lg font-semibold">Invites</h2>
    <p className="text-sm text-muted-foreground">Create an invitation through #{channel.name}. Server membership rules, expiration, and usage limits still apply. Joining the server does not bypass private channel access.</p>
    {permissions.isPending ? <p role="status">Checking invite permissions...</p> : permissions.data?.create ? <InviteDialog community={community} channelId={channel.id}><Button>Create Invite</Button></InviteDialog> : <p className="text-sm text-muted-foreground">You do not have permission to create invitations through this channel.</p>}
  </section>;
}
