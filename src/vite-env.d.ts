/// <reference types="vite/client" />

interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}
interface ImportMetaEnv {
  readonly VITE_AUTH_URL?: string;
  readonly VITE_API_URL?: string;
}
