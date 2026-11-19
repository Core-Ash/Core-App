import { Bot, Webhook, Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ServerSettingsData } from "./types";

export function IntegrationSettings({
  settings,
}: {
  settings: ServerSettingsData;
}) {
  return (
    <div className="space-y-6 max-w-2xl" data-community-id={settings.id}>
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Bot className="size-5 text-primary" /> Integrations & Bots
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          View active bot installations and automated webhooks for this server.
        </p>
      </div>

      {/* Installed Integrations */}
      <div className="space-y-3">
        {/* Core Bot */}
        <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Bot className="size-6" />
            </div>
            <div>
              <div className="font-semibold text-foreground flex items-center gap-2">
                <span>Core Bot</span>
                <Badge variant="default" className="text-[10px] bg-primary/80 uppercase">
                  Official
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Built-in platform assistant for system notices, blocked DMs, and AutoMod.
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-400">Active</span>
        </div>

        {/* Custom Webhooks Card */}
        <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-neutral-800 border border-border flex items-center justify-center text-neutral-300">
              <Webhook className="size-5" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Custom Webhooks</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Post automated messages and updates from GitHub, Discord bridges, or CI.
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled>
            Configure
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppDirectory({
  settings,
}: {
  settings: ServerSettingsData;
}) {
  const APPS = [
    {
      name: "Core Bot",
      desc: "Built-in automated moderation, system warnings, and command runner.",
      icon: Bot,
      installed: true,
    },
    {
      name: "GitHub Commits & PRs",
      desc: "Stream repository events, issues, and release notifications directly into channels.",
      icon: Webhook,
      installed: false,
    },
    {
      name: "Steam & Gaming Status",
      desc: "Display server game session activity and squad matchmaking alerts.",
      icon: Box,
      installed: false,
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl" data-community-id={settings.id}>
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Box className="size-5 text-primary" /> App Directory
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Discover native apps and integrations designed to enhance your server.
        </p>
      </div>

      <div className="grid gap-3">
        {APPS.map((app) => {
          const Icon = app.icon;
          return (
            <div
              key={app.name}
              className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="size-12 rounded-xl bg-neutral-800 border border-border flex items-center justify-center text-primary shrink-0">
                  <Icon className="size-6" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">{app.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {app.desc}
                  </div>
                </div>
              </div>

              {app.installed ? (
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 shrink-0">
                  Installed
                </Badge>
              ) : (
                <Button variant="outline" size="sm" className="shrink-0" disabled>
                  Coming Soon
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
