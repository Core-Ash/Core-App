import { useEffect, useState, type ReactNode } from "react";
import {
  applyPreferencesToDocument,
  defaultPreferences,
  loadStoredPreferences,
  PREFERENCES_STORAGE_KEY,
  PreferencesContext,
  sanitizePreferences,
  type AppPreferences,
} from "@/features/settings/settings-context";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(() =>
    loadStoredPreferences(),
  );

  useEffect(() => {
    applyPreferencesToDocument(preferences);
    try {
      window.localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences),
      );
    } catch {
      // Ignore storage quota or private mode restrictions.
    }
  }, [preferences]);

  function updatePreferences(patch: Partial<AppPreferences>) {
    setPreferences((prev) => sanitizePreferences({ ...prev, ...patch }));
  }

  function resetPreferences() {
    setPreferences(defaultPreferences);
  }

  return (
    <PreferencesContext.Provider
      value={{ preferences, updatePreferences, resetPreferences }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
