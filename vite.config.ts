import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import {
  getDevAuthProxyHttps,
  getDevAuthProxyTarget,
  getDevApiProxyTarget,
} from "./config/dev-auth-proxy.ts";

export default defineConfig(({ command, mode, isPreview }) => {
  // This upstream is server-only and is never exposed through VITE_ variables.
  const env = loadEnv(mode, process.cwd(), "DEV_");
  const proxyTarget =
    command === "serve" && !isPreview
      ? getDevAuthProxyTarget(env.DEV_AUTH_PROXY_TARGET)
      : undefined;
  const apiProxyTarget =
    command === "serve" && !isPreview
      ? getDevApiProxyTarget(env.DEV_API_PROXY_TARGET)
      : undefined;
  const proxyHttps =
    proxyTarget || apiProxyTarget
      ? getDevAuthProxyHttps(env.DEV_AUTH_PROXY_HTTPS)
      : true;

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...((proxyTarget || apiProxyTarget) && proxyHttps
        ? [basicSsl({ name: "Core localhost" })]
        : []),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server:
      proxyTarget || apiProxyTarget
        ? {
            host: "localhost",
            port: 5173,
            strictPort: true,
            https: proxyHttps ? {} : undefined,
            proxy: {
              ...(proxyTarget
                ? {
                    "^/api/auth(?:/|$)": {
                      target: proxyTarget,
                      changeOrigin: true,
                      secure: true,
                      // Preserve Origin and all Set-Cookie security attributes.
                    },
                  }
                : {}),
              ...(apiProxyTarget
                ? {
                    "^/api/v1(?:/|$)": {
                      target: apiProxyTarget,
                      changeOrigin: true,
                      secure: true,
                      // Cookie, browser Origin, and X-Core-CSRF reach Rust unchanged.
                    },
                  }
                : {}),
            },
          }
        : undefined,
  };
});
