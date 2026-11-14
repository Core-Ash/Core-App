import { createContext, useContext } from "react";
import type { ApiClient } from "@/lib/api/client";

export interface AppDataContextValue {
  api: ApiClient;
  ready: boolean;
  configured: boolean;
  configurationError: string | null;
  clearPrivateData: () => void;
}
export const AppDataContext = createContext<AppDataContextValue | null>(null);
export function useOptionalAppData() {
  return useContext(AppDataContext);
}
export function useAppData() {
  const context = useOptionalAppData();
  if (!context) throw new Error("Application data requires AppDataProvider");
  return context;
}
