import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppData } from "@/app/app-data-context";
import { useInvitePermissions } from "@/features/invites/api";
import { queryKeys } from "@/features/community/api/hooks";
import { categoryQueryKeys } from "@/features/community/categories/api";
import { Button } from "@/components/ui/button";
import { ApiNotice } from "@/components/common/ApiNotice";
import { apiErrorMessage } from "@/lib/api/errors";
import type { Channel, Community } from "@/lib/api/types";

export function DeleteChannelSettings({ community, channel, onDeleted }: { community: Community; channel: Channel; onDeleted: () => void }) {
  const { api } = useAppData();
  const queries = useQueryClient();
  const permissions = useInvitePermissions(community.id, channel.id);
  const mutation = useMutation({ mutationFn: () => api.delete(`/communities/${community.id}/channels/${channel.id}`), onSuccess: () => {
    queries.removeQueries({ queryKey: queryKeys.messages(channel.id) });
    for (const key of [queryKeys.channels(community.id), categoryQueryKeys.categories(community.id), ["permission-overwrites", community.id]]) void queries.invalidateQueries({ queryKey: key });
    onDeleted();
  } });
  if (permissions.isError) return <ApiNotice error={permissions.error} />;
  return <section className="space-y-4"><h2 className="text-lg font-semibold">Delete Channel</h2><p className="text-sm text-muted-foreground">Permanently delete #{channel.name}, its messages, and its channel invitations. This cannot be undone.</p>
    {permissions.isPending ? <p role="status">Checking channel management permission...</p> : permissions.data?.manage_channels ? <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Deleting..." : `Permanently delete #${channel.name}`}</Button> : <p className="text-sm text-muted-foreground">You do not have permission to delete this channel.</p>}
    {mutation.isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(mutation.error)}</p>}
  </section>;
}
