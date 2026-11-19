import { KeyRound } from "lucide-react";
import type { ServerSettingsData, UpdateServerSettingsInput } from "./types";

export function AccessSettings({
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
  const currentLevel =
    draft.safety_verification_level !== undefined
      ? draft.safety_verification_level
      : settings.safety_verification_level;

  const LEVELS = [
    {
      id: "none",
      title: "None",
      desc: "Unrestricted. Anyone with an invitation link can join and chat immediately.",
    },
    {
      id: "low",
      title: "Low",
      desc: "Must have a verified email on their Better Auth account.",
    },
    {
      id: "medium",
      title: "Medium",
      desc: "Must also be registered on Core for longer than 5 minutes.",
    },
    {
      id: "high",
      title: "High",
      desc: "Must also be a member of this server for longer than 10 minutes before sending messages.",
    },
  ] as const;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <KeyRound className="size-5 text-primary" /> Access & Screening
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure security verification levels and admission prerequisites for new members.
        </p>
      </div>

      {/* Verification Level */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Verification Level
        </label>
        <div className="grid gap-3">
          {LEVELS.map((lvl) => {
            const isSelected = currentLevel === lvl.id;
            return (
              <label
                key={lvl.id}
                className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card/60 hover:bg-card"
                }`}
              >
                <input
                  type="radio"
                  name="verification_level"
                  disabled={!canManage}
                  checked={isSelected}
                  onChange={() =>
                    onChangeDraft((prev) => ({
                      ...prev,
                      safety_verification_level: lvl.id,
                    }))
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-semibold text-sm text-foreground">{lvl.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {lvl.desc}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
