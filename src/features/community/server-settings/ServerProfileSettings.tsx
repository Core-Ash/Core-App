import { useState } from "react";
import { Upload, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRESET_BANNERS, type ServerSettingsData, type UpdateServerSettingsInput } from "./types";

const DEFAULT_EMOJIS = ["🎮", "🔥", "⚡", "🏆", "🛡️", "💬", "✨", "🚀", "👑", "🎯"];

export function ServerProfileSettings({
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
  const currentName = draft.name ?? settings.name;
  const currentDescription = draft.description !== undefined ? (draft.description ?? "") : (settings.description ?? "");
  const currentIcon = draft.icon_url !== undefined ? (draft.icon_url ?? "") : (settings.icon_url ?? "");
  const currentBanner = draft.banner_url !== undefined ? (draft.banner_url ?? "") : (settings.banner_url ?? PRESET_BANNERS[2]?.gradient);
  const currentHighlights = draft.highlights ?? settings.highlights ?? [];

  const [activePickerIndex, setActivePickerIndex] = useState<number | null>(null);

  // Parse creation date
  const createdDate = new Date(settings.created_at);
  const createdMonthYear = !isNaN(createdDate.getTime())
    ? createdDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Recently";

  if (!canManage) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Server Profile</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customize how your server appears in invites, channel headers, and member profiles.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Server name, icon, and banner editing are unavailable.</p>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="text-sm font-medium">Server Name: {settings.name}</div>
          {settings.description && (
            <div className="text-sm text-muted-foreground">Description: {settings.description}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="server-profile-grid">
      {/* Left Column: Form Controls */}
      <div className="server-profile-form space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Server Profile</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customize how your server appears in invites and previews.
          </p>
        </div>

        {/* Server Name */}
        <div className="space-y-2">
          <label htmlFor="server-name-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Server Name
          </label>
          <Input
            id="server-name-input"
            value={currentName}
            maxLength={100}
            onChange={(e) =>
              onChangeDraft((prev) => ({ ...prev, name: e.target.value }))
            }
            className="bg-background/50"
          />
        </div>

        {/* Server Icon */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Icon
          </label>
          <p className="text-xs text-muted-foreground">
            We recommend an image of at least 512×512 px.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="relative overflow-hidden cursor-pointer"
              onClick={() => {
                const url = window.prompt("Enter icon URL (https://...):", currentIcon);
                if (url !== null) {
                  onChangeDraft((prev) => ({ ...prev, icon_url: url.trim() || null }));
                }
              }}
            >
              <Upload className="size-4 mr-1.5" />
              Change Server Icon
            </Button>
            {currentIcon && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() =>
                  onChangeDraft((prev) => ({ ...prev, icon_url: null }))
                }
              >
                Remove Icon
              </Button>
            )}
          </div>
        </div>

        <div className="h-px bg-border my-4" />

        {/* Server Banner Gradient Swatches */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Banner
          </label>
          <p className="text-xs text-muted-foreground">
            Choose a gradient background for your server banner preview.
          </p>
          <div className="grid grid-cols-5 gap-2.5 pt-1">
            {PRESET_BANNERS.map((preset) => {
              const isSelected = currentBanner === preset.gradient || currentBanner === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-label={preset.label}
                  className={`h-12 rounded-lg transition-transform focus:outline-none focus:ring-2 focus:ring-primary ${
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
                      : "opacity-85 hover:opacity-100 hover:scale-102"
                  }`}
                  style={{ background: preset.gradient }}
                  onClick={() =>
                    onChangeDraft((prev) => ({ ...prev, banner_url: preset.gradient }))
                  }
                />
              );
            })}
          </div>
        </div>

        <div className="h-px bg-border my-4" />

        {/* Server Highlights */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Server Highlights
          </label>
          <p className="text-xs text-muted-foreground">
            Add up to 5 highlights showing the vibe and character of your server.
          </p>
          <div className="grid grid-cols-5 gap-2 pt-1">
            {[0, 1, 2, 3, 4].map((index) => {
              const emoji = currentHighlights[index];
              const isPickerOpen = activePickerIndex === index;
              return (
                <div key={index} className="relative">
                  <button
                    type="button"
                    aria-label={`Highlight ${index + 1}`}
                    className={`w-full h-10 rounded-lg border border-border bg-background/50 flex items-center justify-center text-lg hover:border-primary transition-colors ${
                      emoji ? "border-primary/50" : "text-muted-foreground"
                    }`}
                    onClick={() => setActivePickerIndex(isPickerOpen ? null : index)}
                  >
                    {emoji || "😀"}
                  </button>

                  {isPickerOpen && (
                    <div className="absolute top-12 left-0 z-50 p-2 bg-popover border border-border rounded-lg shadow-xl grid grid-cols-5 gap-1.5 w-48">
                      {DEFAULT_EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          className="size-8 rounded hover:bg-surface-hover flex items-center justify-center text-base"
                          onClick={() => {
                            const updated = [...currentHighlights];
                            updated[index] = e;
                            onChangeDraft((prev) => ({
                              ...prev,
                              highlights: updated.filter(Boolean),
                            }));
                            setActivePickerIndex(null);
                          }}
                        >
                          {e}
                        </button>
                      ))}
                      {emoji && (
                        <button
                          type="button"
                          className="col-span-5 text-xs text-destructive hover:underline py-1 mt-1 text-center"
                          onClick={() => {
                            const updated = currentHighlights.filter((_, i) => i !== index);
                            onChangeDraft((prev) => ({ ...prev, highlights: updated }));
                            setActivePickerIndex(null);
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-border my-4" />

        {/* Server Description */}
        <div className="space-y-2">
          <label htmlFor="server-desc-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Description
          </label>
          <p className="text-xs text-muted-foreground">
            What led to your server's creation? Why should people join?
          </p>
          <Textarea
            id="server-desc-input"
            value={currentDescription}
            maxLength={1024}
            rows={4}
            placeholder="Tell the world a bit about this server..."
            onChange={(e) =>
              onChangeDraft((prev) => ({ ...prev, description: e.target.value }))
            }
            className="bg-background/50 resize-none"
          />
          <div className="text-right text-xs text-muted-foreground">
            {currentDescription.length} / 1024
          </div>
        </div>
      </div>

      {/* Right Column: Live Discord Server Preview Card */}
      <div className="server-preview-column">
        <div className="sticky top-6">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Preview
          </div>

          <div
            className="server-preview-card rounded-2xl overflow-hidden shadow-2xl border border-border/80 bg-neutral-900 w-full max-w-[320px]"
          >
            {/* Banner Header */}
            <div
              className="h-28 w-full relative transition-all"
              style={{
                background: currentBanner?.startsWith("http")
                  ? `url(${currentBanner}) center/cover no-repeat`
                  : currentBanner,
              }}
            >
              {/* Server Icon Overlapping */}
              <div className="absolute -bottom-6 left-4">
                <div className="size-16 rounded-2xl bg-neutral-800 border-4 border-neutral-900 overflow-hidden flex items-center justify-center shadow-lg">
                  {currentIcon ? (
                    <img
                      src={currentIcon}
                      alt={currentName}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-black text-foreground">
                      {currentName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="pt-8 pb-4 px-4 space-y-3">
              {/* Name & Badge */}
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-base text-foreground leading-tight truncate">
                  {currentName || "Unnamed Server"}
                </h3>
                <ShieldCheck className="size-4 text-primary shrink-0" />
              </div>

              {/* Stats & Meta */}
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block size-2 rounded-full bg-emerald-500" />
                  <span>
                    {settings.member_count > 0 ? `${settings.member_count} members` : "1 member"}
                  </span>
                </div>
                <div>Created {createdMonthYear}</div>
              </div>

              {/* Highlights pills */}
              {currentHighlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
                  {currentHighlights.map((emoji, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-full bg-neutral-800 text-sm border border-border/40"
                    >
                      {emoji}
                    </span>
                  ))}
                </div>
              )}

              {/* Description preview */}
              {currentDescription && (
                <p className="text-xs text-neutral-300 pt-2 border-t border-border/40 line-clamp-3 leading-relaxed">
                  {currentDescription}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
