import { useState } from "react";
import { ShieldCheck, History, Ban, ShieldAlert, Search, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/common/UserAvatar";
import {
  useServerAuditLogs,
  useServerBans,
  useUnbanMember,
  useServerAutoMod,
  useCreateAutoModRule,
  useUpdateAutoModRule,
  useDeleteAutoModRule,
} from "./api";
import type { ServerSettingsData, UpdateServerSettingsInput } from "./types";

export function SafetySettings({
  settings,
  canManage,
  draft,
  onChangeDraft,
}: {
  settings: ServerSettingsData;
  canManage: boolean;
  draft: UpdateServerSettingsInput;
  onChangeDraft: (updater: (prev: UpdateServerSettingsInput) => UpdateServerSettingsInput) => void;
}) {
  const spamProtection =
    draft.safety_spam_protection !== undefined
      ? draft.safety_spam_protection
      : settings.safety_spam_protection;

  const mentionLimit =
    draft.safety_mention_limit !== undefined
      ? draft.safety_mention_limit
      : settings.safety_mention_limit;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" /> Safety Setup
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure automated protections to safeguard your community against spam and raids.
        </p>
      </div>

      {/* Spam Protection Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
        <div>
          <div className="font-semibold text-foreground">Anti-Spam Filter</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Automatically detect and suppress rapid repeated messages sent in text channels.
          </div>
        </div>
        <Switch
          disabled={!canManage}
          checked={spamProtection}
          onCheckedChange={(checked) =>
            onChangeDraft((prev) => ({ ...prev, safety_spam_protection: checked }))
          }
        />
      </div>

      {/* Mention Limits */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div>
          <div className="font-semibold text-foreground">Mention Threshold</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Maximum unique user or role mentions allowed in a single message before blocking.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={1}
            max={50}
            disabled={!canManage}
            value={mentionLimit}
            onChange={(e) =>
              onChangeDraft((prev) => ({
                ...prev,
                safety_mention_limit: Math.max(1, parseInt(e.target.value) || 5),
              }))
            }
            className="w-24 bg-background/50"
          />
          <span className="text-xs text-muted-foreground">mentions per message</span>
        </div>
      </div>
    </div>
  );
}

export function AuditLogSettings({
  settings,
}: {
  settings: ServerSettingsData;
}) {
  const [actionFilter, setActionFilter] = useState<string>("");
  const logsQuery = useServerAuditLogs(settings.id, actionFilter || undefined);
  const items = logsQuery.data?.items ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <History className="size-5 text-primary" /> Audit Log
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Chronological audit of administrative actions and settings changes.
          </p>
        </div>

        {/* Filter dropdown */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-xs"
        >
          <option value="">All Actions</option>
          <option value="community_settings_updated">Server Settings Updated</option>
          <option value="role_created">Role Created</option>
          <option value="role_updated">Role Updated</option>
          <option value="role_deleted">Role Deleted</option>
          <option value="member_roles_updated">Member Roles Updated</option>
          <option value="member_kicked">Member Kicked</option>
          <option value="member_banned">Member Banned</option>
          <option value="member_unbanned">Member Unbanned</option>
          <option value="automod_rule_created">AutoMod Rule Created</option>
          <option value="emoji_created">Emoji Created</option>
        </select>
      </div>

      {/* Audit Log Timeline */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border/60">
        {items.map((log) => {
          const created = new Date(log.created_at);
          const timeFormatted = !isNaN(created.getTime())
            ? created.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—";

          return (
            <div key={log.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <UserAvatar
                  user={{
                    name: log.actor?.display_name || "System",
                    image: log.actor?.avatar_url,
                    email: log.actor?.username || "system",
                  }}
                  className="size-9"
                />
                <div>
                  <div className="text-sm">
                    <span className="font-semibold text-foreground">
                      {log.actor?.display_name || "Unknown Administrator"}
                    </span>{" "}
                    <span className="text-muted-foreground">performed</span>{" "}
                    <code className="text-xs bg-neutral-800 text-primary px-1.5 py-0.5 rounded border border-border">
                      {log.action_type}
                    </code>
                  </div>
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div className="mt-1.5 text-xs text-muted-foreground font-mono bg-neutral-900/60 p-2 rounded border border-border/50 max-w-xl overflow-x-auto">
                      {JSON.stringify(log.changes, null, 2)}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">{timeFormatted}</div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No audit log entries recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}

export function BanSettings({
  settings,
  canManage,
}: {
  settings: ServerSettingsData;
  canManage: boolean;
}) {
  const bansQuery = useServerBans(settings.id);
  const unban = useUnbanMember(settings.id);
  const [search, setSearch] = useState("");

  const items = (bansQuery.data?.items ?? []).filter((ban) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      ban.display_name?.toLowerCase().includes(term) ||
      ban.username?.toLowerCase().includes(term) ||
      ban.reason?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Ban className="size-5 text-destructive" /> Server Bans
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage banned users who are prevented from joining this server.
          </p>
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          {items.length} Bans Active
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Search bans by username or reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-background/50"
        />
      </div>

      {/* Bans Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-neutral-900/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Reason</th>
              <th className="py-3 px-4">Banned By</th>
              <th className="py-3 px-4">Date</th>
              {canManage && <th className="py-3 px-4 text-right">Revoke Ban</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-sm">
            {items.map((ban) => {
              const date = new Date(ban.created_at);
              const formattedDate = !isNaN(date.getTime())
                ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "—";

              return (
                <tr key={ban.user_id} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar
                        user={{
                          name: ban.display_name || "Banned User",
                          image: ban.avatar_url,
                          email: ban.username || "user",
                        }}
                        className="size-7"
                      />
                      <div>
                        <div className="font-semibold text-foreground text-xs">
                          {ban.display_name || "Unknown"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          @{ban.username || "user"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {ban.reason || "No reason specified"}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {ban.banned_by_name || "Moderator"}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {formattedDate}
                  </td>
                  {canManage && (
                    <td className="py-3 px-4 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={unban.isPending}
                        onClick={() => unban.mutate(ban.user_id)}
                      >
                        Unban
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No active bans found for this server.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AutoModSettings({
  settings,
  canManage,
}: {
  settings: ServerSettingsData;
  canManage: boolean;
}) {
  const automod = useServerAutoMod(settings.id);
  const createRule = useCreateAutoModRule(settings.id);
  const updateRule = useUpdateAutoModRule(settings.id);
  const deleteRule = useDeleteAutoModRule(settings.id);

  const [showAdd, setShowAdd] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [triggerType, setTriggerType] = useState<"keyword" | "spam" | "mention">("keyword");
  const [keywords, setKeywords] = useState("");

  const items = automod.data?.items ?? [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    const meta =
      triggerType === "keyword"
        ? {
            keywords: keywords
              .split(",")
              .map((w) => w.trim())
              .filter(Boolean),
          }
        : {};

    createRule.mutate(
      {
        name: ruleName.trim(),
        enabled: true,
        trigger_type: triggerType,
        trigger_metadata: meta,
        actions: ["block_message"],
      },
      {
        onSuccess: () => {
          setRuleName("");
          setKeywords("");
          setShowAdd(false);
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="size-5 text-primary" /> AutoMod
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Automatically moderate and block harmful messages before they appear in channels.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="size-4 mr-1.5" /> Create AutoMod Rule
          </Button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="p-4 rounded-xl border border-border bg-card space-y-4 max-w-lg">
          <div className="text-sm font-semibold text-foreground">New Automated Rule</div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Rule Name</label>
            <Input
              placeholder="e.g. Block Prohibited Words"
              maxLength={100}
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Trigger Type</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as "keyword" | "spam" | "mention")}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs"
            >
              <option value="keyword">Blocked Keywords</option>
              <option value="spam">Suspected Spam Content</option>
              <option value="mention">Excessive Mentions</option>
            </select>
          </div>
          {triggerType === "keyword" && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                Blocked Words (comma separated)
              </label>
              <Input
                placeholder="badword1, scam, phishing"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" size="sm" disabled={createRule.isPending}>
              Create Rule
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Rules List */}
      <div className="space-y-3">
        {items.map((rule) => {
          const ruleKeywords = (rule.trigger_metadata?.keywords as string[]) ?? [];
          return (
            <div
              key={rule.id}
              className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">{rule.name}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-800 text-muted-foreground border border-border">
                    {rule.trigger_type}
                  </span>
                </div>
                {ruleKeywords.length > 0 && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <span>Keywords:</span>
                    <span className="font-mono text-neutral-300">{ruleKeywords.join(", ")}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  disabled={!canManage}
                  checked={rule.enabled}
                  onCheckedChange={(checked) =>
                    updateRule.mutate({ ruleId: rule.id, enabled: checked })
                  }
                />
                {canManage && (
                  <button
                    type="button"
                    aria-label={`Delete ${rule.name}`}
                    onClick={() => deleteRule.mutate(rule.id)}
                    className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
            No AutoMod rules enabled. Add rules to filter prohibited words or spam.
          </div>
        )}
      </div>
    </div>
  );
}
