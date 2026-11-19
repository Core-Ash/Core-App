import { useState } from "react";
import { Users2, Copy, FileText, Trash2, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useChannels } from "@/features/community/api/hooks";
import {
  useServerTemplates,
  useCreateServerTemplate,
  useDeleteServerTemplate,
  useDeleteServer,
} from "./api";
import type { ServerSettingsData, UpdateServerSettingsInput } from "./types";

export function CommunitySettings({
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
  const channels = useChannels(settings.id);
  const isEnabled =
    draft.community_enabled !== undefined
      ? draft.community_enabled
      : settings.community_enabled;
  const rulesChannel =
    draft.rules_channel_id !== undefined
      ? draft.rules_channel_id
      : settings.rules_channel_id;
  const announcementChannel =
    draft.announcement_channel_id !== undefined
      ? draft.announcement_channel_id
      : settings.announcement_channel_id;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users2 className="size-5 text-primary" /> Community Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Transform your private squad into a public Community with designated announcement and rules channels.
        </p>
      </div>

      {/* Enable Community Mode */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
        <div>
          <div className="font-semibold text-foreground">Enable Community Mode</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Activates community onboarding tools, announcement channels, and safety screening.
          </div>
        </div>
        <Switch
          disabled={!canManage}
          checked={isEnabled}
          onCheckedChange={(checked) =>
            onChangeDraft((prev) => ({ ...prev, community_enabled: checked }))
          }
        />
      </div>

      <div className={`space-y-4 p-4 rounded-xl border border-border bg-card ${!isEnabled ? "opacity-60 pointer-events-none" : ""}`}>
        {/* Rules Channel Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Rules or Guidelines Channel
          </label>
          <select
            value={rulesChannel ?? ""}
            disabled={!canManage}
            onChange={(e) =>
              onChangeDraft((prev) => ({
                ...prev,
                rules_channel_id: e.target.value || null,
              }))
            }
            className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Select a channel...</option>
            {channels.data?.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Announcement Channel Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Community Updates & Announcements Channel
          </label>
          <select
            value={announcementChannel ?? ""}
            disabled={!canManage}
            onChange={(e) =>
              onChangeDraft((prev) => ({
                ...prev,
                announcement_channel_id: e.target.value || null,
              }))
            }
            className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Select a channel...</option>
            {channels.data?.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export function TemplateSettings({
  settings,
  canManage,
}: {
  settings: ServerSettingsData;
  canManage: boolean;
}) {
  const templates = useServerTemplates(settings.id);
  const createTemplate = useCreateServerTemplate(settings.id);
  const deleteTemplate = useDeleteServerTemplate(settings.id);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const items = templates.data?.items ?? [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createTemplate.mutate(
      { name: name.trim(), description: desc.trim() || undefined },
      {
        onSuccess: () => {
          setName("");
          setDesc("");
          setShowAdd(false);
        },
      }
    );
  };

  const handleCopy = (code: string) => {
    const url = `${window.location.origin}/template/${code}`;
    void navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="size-5 text-primary" /> Server Templates
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate reusable blueprints containing your server's channel and role structures.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={() => setShowAdd(!showAdd)}>
            Create Template
          </Button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="p-4 rounded-xl border border-border bg-card space-y-4 max-w-md">
          <div className="text-sm font-semibold text-foreground">New Server Template</div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Template Name</label>
            <Input
              placeholder="e.g. Gaming Squad Layout"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Description (Optional)</label>
            <Input
              placeholder="Includes gaming channels and roles..."
              maxLength={200}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" size="sm" disabled={createTemplate.isPending}>
              Generate Template
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Templates List */}
      <div className="space-y-3">
        {items.map((tmpl) => (
          <div
            key={tmpl.id}
            className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4"
          >
            <div className="space-y-1 truncate">
              <div className="font-semibold text-foreground text-sm truncate">{tmpl.name}</div>
              {tmpl.description && (
                <div className="text-xs text-muted-foreground truncate">{tmpl.description}</div>
              )}
              <div className="text-[11px] font-mono text-primary flex items-center gap-2">
                <span>Code: {tmpl.code}</span>
                <button
                  type="button"
                  aria-label="Copy template link"
                  onClick={() => handleCopy(tmpl.code)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {copiedCode === tmpl.code ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              </div>
            </div>

            {canManage && (
              <button
                type="button"
                aria-label={`Delete ${tmpl.name}`}
                onClick={() => deleteTemplate.mutate(tmpl.id)}
                className="text-muted-foreground hover:text-destructive p-1 transition-colors"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}

        {items.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No templates generated for this server yet.
          </div>
        )}
      </div>
    </div>
  );
}

export function DeleteServerSettings({
  settings,
  isOwner,
  onDeleted,
}: {
  settings: ServerSettingsData;
  isOwner: boolean;
  onDeleted?: () => void;
}) {
  const deleteServer = useDeleteServer(settings.id);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState("");

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (confirmName.trim() !== settings.name.trim()) {
      setError("Entered server name does not match exact server name");
      return;
    }

    deleteServer.mutate(confirmName.trim(), {
      onSuccess: () => {
        onDeleted?.();
      },
      onError: (err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to delete server");
      },
    });
  };

  if (!isOwner) {
    return (
      <div className="p-5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-medium">
        Only the server owner can permanently delete this server.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-xl font-bold text-destructive flex items-center gap-2">
          <Trash2 className="size-5" /> Delete Server
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Permanently delete this server and all associated channels, messages, roles, and media.
        </p>
      </div>

      <div className="p-5 rounded-xl border border-destructive/40 bg-destructive/10 space-y-4">
        <div className="flex items-start gap-3 text-destructive">
          <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong>Warning:</strong> This action cannot be undone. All messages, channels, member memberships, and customized assets will be erased immediately.
          </div>
        </div>

        <form onSubmit={handleDelete} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Enter Server Name: <span className="text-foreground">{settings.name}</span>
            </label>
            <Input
              value={confirmName}
              placeholder={settings.name}
              onChange={(e) => setConfirmName(e.target.value)}
              className="border-destructive/40 bg-background/50 focus-visible:ring-destructive"
            />
          </div>

          {error && <div className="text-xs text-destructive font-semibold">{error}</div>}

          <Button
            type="submit"
            className="w-full font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={confirmName.trim() !== settings.name.trim() || deleteServer.isPending}
          >
            {deleteServer.isPending ? "Deleting Server..." : "Delete Server Permanently"}
          </Button>
        </form>
      </div>
    </div>
  );
}
