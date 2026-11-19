import { Sparkles, Zap, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ServerSettingsData } from "./types";

export function BoostPerksSettings({
  settings,
}: {
  settings: ServerSettingsData;
}) {
  const TIERS = [
    {
      level: "Level 1",
      perks: [
        "50 Custom Emoji Slots (Enabled)",
        "30 Custom Sticker Slots (Enabled)",
        "Custom Gradient Server Banners (Enabled)",
        "Core Server Tag Customization (Enabled)",
      ],
      active: true,
    },
    {
      level: "Level 2",
      perks: [
        "100 Custom Emoji Slots",
        "60 Custom Sticker Slots",
        "Animated Server Icon",
        "Server Banner Custom Image Upload",
      ],
      active: false,
      requiresBilling: true,
    },
    {
      level: "Level 3",
      perks: [
        "250 Custom Emoji Slots",
        "100 Custom Sticker Slots",
        "Custom Vanity URL Invitation",
        "100MB File Upload Limit",
      ],
      active: false,
      requiresBilling: true,
    },
  ];

  return (
    <div className="space-y-6 max-w-2xl" data-community-id={settings.id}>
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="size-5 text-amber-400" /> Boost Perks & Entitlements
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Explore server capabilities and perks available to your community.
        </p>
      </div>

      {/* Current Server Tier Banner */}
      <div className="p-5 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-background to-background flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Current Server Tier:</span>
            <Badge variant="default" className="bg-primary text-white">
              Standard Community
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            All core customization features (emojis, stickers, gradient banners, tags) are unlocked by default.
          </p>
        </div>
        <Zap className="size-8 text-primary/80 shrink-0" />
      </div>

      {/* Perks Tiers */}
      <div className="grid gap-4">
        {TIERS.map((tier) => (
          <div
            key={tier.level}
            className={`p-4 rounded-lg border transition-all ${
              tier.active
                ? "border-primary/50 bg-card"
                : "border-border bg-card/60 opacity-80"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-foreground">{tier.level}</span>
              {tier.active ? (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  Active
                </span>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  Requires future billing infrastructure
                </span>
              )}
            </div>

            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {tier.perks.map((perk, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className={`size-1.5 rounded-full ${tier.active ? "bg-primary" : "bg-muted"}`} />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Billing Dependency Note */}
      <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200/90 flex items-start gap-2">
        <ShieldAlert className="size-4 shrink-0 text-amber-400 mt-0.5" />
        <span>
          <strong>Platform Notice:</strong> Higher boost tiers and recurring community monetization will integrate with Core's forthcoming billing service. No mock payment flow is used.
        </span>
      </div>
    </div>
  );
}
