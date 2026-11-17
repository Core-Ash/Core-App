import { createContext, useContext } from "react";

export type SettingsSection =
  | "my-account"
  | "profiles"
  | "privacy-safety"
  | "friend-requests"
  | "voice-audio"
  | "notifications"
  | "appearance"
  | "accessibility";

export interface SettingsModalContextValue {
  open: boolean;
  section: SettingsSection;
  openSettings: (section?: SettingsSection, trigger?: HTMLElement | null) => void;
  closeSettings: () => void;
  selectSection: (section: SettingsSection) => void;
}

export const SettingsModalContext = createContext<SettingsModalContextValue | null>(null);

export function useOptionalSettingsModal() {
  return useContext(SettingsModalContext);
}

export type ChatFontSize = "14px" | "15px" | "16px";
export type MessageDisplayMode = "cozy" | "compact";
export type MotionPreference = "system" | "reduce" | "full";
export type InterfaceZoom = "90" | "100" | "110";
export type InputMode = "voice-activity" | "push-to-talk";

export interface AppPreferences {
  chatFontSize: ChatFontSize;
  messageDisplay: MessageDisplayMode;
  motion: MotionPreference;
  contrast: boolean;
  zoom: InterfaceZoom;
  inputDeviceId: string;
  outputDeviceId: string;
  inputVolume: number;
  outputVolume: number;
  inputMode: InputMode;
}

export const PREFERENCES_STORAGE_KEY = "core.preferences.v1";

export const defaultPreferences: AppPreferences = {
  chatFontSize: "14px",
  messageDisplay: "cozy",
  motion: "system",
  contrast: false,
  zoom: "100",
  inputDeviceId: "default",
  outputDeviceId: "default",
  inputVolume: 100,
  outputVolume: 100,
  inputMode: "voice-activity",
};

export function sanitizePreferences(raw: unknown): AppPreferences {
  if (!raw || typeof raw !== "object") return defaultPreferences;
  const data = raw as Record<string, unknown>;
  return {
    chatFontSize:
      data.chatFontSize === "14px" || data.chatFontSize === "15px" || data.chatFontSize === "16px"
        ? data.chatFontSize
        : defaultPreferences.chatFontSize,
    messageDisplay:
      data.messageDisplay === "cozy" || data.messageDisplay === "compact"
        ? data.messageDisplay
        : defaultPreferences.messageDisplay,
    motion:
      data.motion === "system" || data.motion === "reduce" || data.motion === "full"
        ? data.motion
        : defaultPreferences.motion,
    contrast: typeof data.contrast === "boolean" ? data.contrast : defaultPreferences.contrast,
    zoom:
      data.zoom === "90" || data.zoom === "100" || data.zoom === "110"
        ? data.zoom
        : defaultPreferences.zoom,
    inputDeviceId:
      typeof data.inputDeviceId === "string" && data.inputDeviceId
        ? data.inputDeviceId
        : defaultPreferences.inputDeviceId,
    outputDeviceId:
      typeof data.outputDeviceId === "string" && data.outputDeviceId
        ? data.outputDeviceId
        : defaultPreferences.outputDeviceId,
    inputVolume:
      typeof data.inputVolume === "number" && Number.isFinite(data.inputVolume)
        ? Math.max(0, Math.min(100, Math.round(data.inputVolume)))
        : defaultPreferences.inputVolume,
    outputVolume:
      typeof data.outputVolume === "number" && Number.isFinite(data.outputVolume)
        ? Math.max(0, Math.min(100, Math.round(data.outputVolume)))
        : defaultPreferences.outputVolume,
    inputMode:
      data.inputMode === "voice-activity" || data.inputMode === "push-to-talk"
        ? data.inputMode
        : defaultPreferences.inputMode,
  };
}

export function loadStoredPreferences(): AppPreferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return defaultPreferences;
    return sanitizePreferences(JSON.parse(raw));
  } catch {
    return defaultPreferences;
  }
}

export function applyPreferencesToDocument(preferences: AppPreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--chat-font-size", preferences.chatFontSize);
  root.dataset.messageDisplay = preferences.messageDisplay;
  root.dataset.motion = preferences.motion;
  root.dataset.contrast = preferences.contrast ? "high" : "standard";
  root.dataset.zoom = preferences.zoom;
}

export interface PreferencesContextValue {
  preferences: AppPreferences;
  updatePreferences: (patch: Partial<AppPreferences>) => void;
  resetPreferences: () => void;
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    return {
      preferences: defaultPreferences,
      updatePreferences: () => {},
      resetPreferences: () => {},
    };
  }
  return context;
}
