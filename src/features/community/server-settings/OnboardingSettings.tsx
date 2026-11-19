import { useState } from "react";
import { UserCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useChannels } from "@/features/community/api/hooks";
import { useServerOnboarding, useUpdateServerOnboarding } from "./api";
import type { ServerOnboardingData, ServerSettingsData } from "./types";

function OnboardingForm({
  settingsId,
  canManage,
  initialData,
}: {
  settingsId: string;
  canManage: boolean;
  initialData?: ServerOnboardingData;
}) {
  const updateOnboarding = useUpdateServerOnboarding(settingsId);
  const channels = useChannels(settingsId);

  const [enabled, setEnabled] = useState(initialData?.enabled ?? false);
  const [welcomeMessage, setWelcomeMessage] = useState(initialData?.welcome_message ?? "");
  const [rules, setRules] = useState(initialData?.rules ?? "");
  const [defaultChannels, setDefaultChannels] = useState<string[]>(initialData?.default_channels ?? []);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = () => {
    updateOnboarding.mutate(
      {
        enabled,
        welcome_message: welcomeMessage || null,
        rules: rules || null,
        default_channels: defaultChannels,
      },
      {
        onSuccess: () => {
          setSavedNotice(true);
          setTimeout(() => setSavedNotice(false), 3000);
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <UserCheck className="size-5 text-primary" /> Onboarding
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Design the introductory experience shown to new members when they join your server.
        </p>
      </div>

      {/* Enable Onboarding */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
        <div>
          <div className="font-medium text-foreground">Enable Onboarding</div>
          <div className="text-xs text-muted-foreground">
            Present new members with guidelines and default channel recommendations upon joining.
          </div>
        </div>
        <Switch
          disabled={!canManage}
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      <div className={`space-y-5 p-4 rounded-lg border border-border bg-card ${!enabled ? "opacity-60 pointer-events-none" : ""}`}>
        {/* Welcome Message */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Welcome Message
          </label>
          <Textarea
            value={welcomeMessage}
            disabled={!canManage}
            rows={3}
            placeholder="Welcome to the server! Introduce yourself in general chat..."
            onChange={(e) => setWelcomeMessage(e.target.value)}
            className="bg-background/50 resize-none"
          />
        </div>

        {/* Server Rules */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Server Guidelines & Rules
          </label>
          <Textarea
            value={rules}
            disabled={!canManage}
            rows={4}
            placeholder="1. Be respectful to other members.&#10;2. No spam or unsolicited promotions.&#10;3. Follow channel topics."
            onChange={(e) => setRules(e.target.value)}
            className="bg-background/50 resize-none"
          />
        </div>

        {/* Default Channels */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Default Channels for New Members
          </label>
          <p className="text-xs text-muted-foreground">
            Select channels that will be automatically opened for new members.
          </p>
          <div className="space-y-1.5 pt-1">
            {channels.data?.map((channel) => {
              const isSelected = defaultChannels.includes(channel.id);
              return (
                <label
                  key={channel.id}
                  className="flex items-center gap-2.5 p-2 rounded-md hover:bg-surface-hover cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    disabled={!canManage}
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDefaultChannels([...defaultChannels, channel.id]);
                      } else {
                        setDefaultChannels(defaultChannels.filter((id) => id !== channel.id));
                      }
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-muted-foreground">#</span>
                  <span className="font-medium text-foreground">{channel.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {canManage && (
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <Button
              type="button"
              disabled={updateOnboarding.isPending}
              onClick={handleSave}
            >
              Save Onboarding
            </Button>
            {savedNotice && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <Check className="size-4" /> Onboarding saved!
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function OnboardingSettings({
  settings,
  canManage,
}: {
  settings: ServerSettingsData;
  canManage: boolean;
}) {
  const onboarding = useServerOnboarding(settings.id);

  if (onboarding.isPending) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading onboarding configuration...</div>;
  }

  return (
    <OnboardingForm
      key={settings.id}
      settingsId={settings.id}
      canManage={canManage}
      initialData={onboarding.data}
    />
  );
}
