import { useState } from "react";
import { Link2, Copy, Trash2, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInvites, useRevokeInvite, useCreateInvite } from "@/features/invites/api";
import type { ServerSettingsData } from "./types";

export function InviteSettings({
  settings,
  canManage,
}: {
  settings: ServerSettingsData;
  canManage: boolean;
}) {
  const invites = useInvites(settings.id, true);
  const revoke = useRevokeInvite(settings.id);
  const create = useCreateInvite(settings.id);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expiresIn, setExpiresIn] = useState<number | undefined>(604800); // 7 days
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);

  const items = invites.data?.pages.flatMap((p) => p.items) ?? [];

  const handleCopy = (code: string, id: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    void navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { expires_in_seconds: expiresIn ?? null, max_uses: maxUses ?? null },
      {
        onSuccess: () => {
          setShowCreate(false);
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Link2 className="size-5 text-primary" /> Invites
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage active invite links and monitor usage statistics.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="size-4 mr-1.5" /> Create Invite Link
          </Button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="p-4 rounded-xl border border-border bg-card space-y-4 max-w-md">
          <div className="text-sm font-semibold text-foreground">New Invitation Link</div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">Expires After</label>
              <select
                value={expiresIn ?? ""}
                onChange={(e) => setExpiresIn(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full h-9 rounded-md border border-border bg-background px-2"
              >
                <option value={1800}>30 minutes</option>
                <option value={3600}>1 hour</option>
                <option value={21600}>6 hours</option>
                <option value={43200}>12 hours</option>
                <option value={86400}>1 day</option>
                <option value={604800}>7 days</option>
                <option value="">Never</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">Max Uses</label>
              <select
                value={maxUses ?? ""}
                onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full h-9 rounded-md border border-border bg-background px-2"
              >
                <option value="">No limit</option>
                <option value={1}>1 use</option>
                <option value={5}>5 uses</option>
                <option value={10}>10 uses</option>
                <option value={25}>25 uses</option>
                <option value={50}>50 uses</option>
                <option value={100}>100 uses</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" size="sm" disabled={create.isPending}>
              Generate Link
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Invites Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-neutral-900/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="py-3 px-4">Invite Code</th>
              <th className="py-3 px-4">Created By</th>
              <th className="py-3 px-4">Uses</th>
              <th className="py-3 px-4">Expires</th>
              <th className="py-3 px-4">Status</th>
              {canManage && <th className="py-3 px-4 text-right">Revoke</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-sm">
            {items.map((invite) => {
              const expires = invite.expires_at ? new Date(invite.expires_at).toLocaleDateString() : "Never";
              return (
                <tr key={invite.id} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[120px]">{invite.id.slice(0, 8)}...</span>
                      <button
                        type="button"
                        aria-label="Copy invite link"
                        onClick={() => handleCopy(invite.id, invite.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {copiedId === invite.id ? (
                          <Check className="size-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{invite.creator}</td>
                  <td className="py-3 px-4 text-xs">
                    {invite.uses} {invite.max_uses ? `/ ${invite.max_uses}` : "uses"}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{expires}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        invite.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-neutral-800 text-muted-foreground border border-border"
                      }`}
                    >
                      {invite.status}
                    </span>
                  </td>
                  {canManage && (
                    <td className="py-3 px-4 text-right">
                      {invite.status === "active" && (
                        <button
                          type="button"
                          aria-label="Revoke invite"
                          onClick={() => revoke.mutate(invite.id)}
                          className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No invitations generated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
