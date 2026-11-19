import { Tag, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useServerTagPreference, useUpdateServerTagPreference } from "./api";
import type { ServerSettingsData, UpdateServerSettingsInput } from "./types";

export function ServerTagSettings({
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
  const currentTag = draft.tag !== undefined ? (draft.tag ?? "") : (settings.tag ?? "");
  const currentColor = draft.tag_color !== undefined ? (draft.tag_color ?? "#f04450") : (settings.tag_color ?? "#f04450");
  const currentBadge = draft.tag_badge !== undefined ? (draft.tag_badge ?? "⚔️") : (settings.tag_badge ?? "⚔️");
  const isEnabled = draft.tag_enabled !== undefined ? draft.tag_enabled : settings.tag_enabled;

  const tagPref = useServerTagPreference(settings.id);
  const updatePref = useUpdateServerTagPreference(settings.id);

  const BADGE_PRESETS = ["⚔️", "🛡️", "🔥", "👑", "⚡", "🌟", "🎯", "💎"];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Tag className="size-5 text-primary" /> Server Tag
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a unique 4-character tag that members can choose to display next to their name.
        </p>
      </div>

      {/* Enable Tag Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
        <div>
          <div className="font-medium text-foreground">Enable Server Tag</div>
          <div className="text-xs text-muted-foreground">
            Allow members of this server to showcase the server tag on their user profile.
          </div>
        </div>
        <Switch
          disabled={!canManage}
          checked={isEnabled}
          onCheckedChange={(checked) =>
            onChangeDraft((prev) => ({ ...prev, tag_enabled: checked }))
          }
        />
      </div>

      {/* Tag Configuration Form */}
      <div className={`space-y-5 p-4 rounded-lg border border-border bg-card ${!isEnabled ? "opacity-60 pointer-events-none" : ""}`}>
        {/* Tag Input */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tag (Max 4 characters)
          </label>
          <Input
            value={currentTag}
            maxLength={4}
            disabled={!canManage}
            placeholder="CORE"
            onChange={(e) =>
              onChangeDraft((prev) => ({ ...prev, tag: e.target.value.toUpperCase() }))
            }
            className="w-32 uppercase font-bold text-center tracking-widest bg-background/50"
          />
        </div>

        {/* Tag Color */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tag Accent Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              disabled={!canManage}
              value={currentColor}
              onChange={(e) =>
                onChangeDraft((prev) => ({ ...prev, tag_color: e.target.value }))
              }
              className="size-10 rounded border border-border cursor-pointer bg-transparent"
            />
            <span className="text-xs font-mono text-muted-foreground uppercase">{currentColor}</span>
          </div>
        </div>

        {/* Badge Picker */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tag Icon / Badge
          </label>
          <div className="flex items-center gap-2">
            {BADGE_PRESETS.map((badge) => (
              <button
                key={badge}
                type="button"
                disabled={!canManage}
                className={`size-9 rounded-md border text-base flex items-center justify-center transition-all ${
                  currentBadge === badge
                    ? "border-primary bg-primary/20 scale-105"
                    : "border-border bg-background hover:bg-surface-hover"
                }`}
                onClick={() => onChangeDraft((prev) => ({ ...prev, tag_badge: badge }))}
              >
                {badge}
              </button>
            ))}
          </div>
        </div>

        {/* Live Tag Preview */}
        <div className="pt-3 border-t border-border">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Tag Preview
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold shadow-sm"
               style={{ backgroundColor: `${currentColor}25`, color: currentColor, border: `1px solid ${currentColor}60` }}>
            <span>{currentBadge}</span>
            <span>[{currentTag || "TAG"}]</span>
          </div>
        </div>
      </div>

      {/* Member Preference Section */}
      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="size-4 text-amber-400" /> Display Tag on My Profile
            </div>
            <div className="text-xs text-muted-foreground">
              Choose whether to show this server tag next to your name across Core.
            </div>
          </div>
          <Switch
            checked={tagPref.data?.display_tag ?? true}
            disabled={tagPref.isPending || updatePref.isPending}
            onCheckedChange={(checked) => updatePref.mutate(checked)}
          />
        </div>
      </div>
    </div>
  );
}
