import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import type { PluginOption } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Where Nitro writes the static files it serves. The service worker must be
// generated there, after the client build, so it can precache the real assets.
const onVercel = !!process.env.VERCEL || process.env.NITRO_PRESET === "vercel";
const staticOutDir = onVercel ? ".vercel/output/static" : ".output/public";

// Generate the service worker in the browser build only. Otherwise sw.js is
// rewritten during the server builds too, after Nitro has recorded its size,
// and Nitro then serves a truncated file. The other PWA sub-plugins provide
// virtual modules the server build also imports, so they stay enabled.
const swInClientBuildOnly = (plugins: PluginOption[]) =>
  plugins.map((p) =>
    p && typeof p === "object" && "name" in p && p.name === "vite-plugin-pwa:build"
      ? { ...p, applyToEnvironment: (env: { name: string }) => env.name === "client" }
      : p,
  );

export default defineConfig({
  server: { host: "::", port: 8080 },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Keep server-only code out of the client bundle
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // Server build adapter; on Vercel the preset is picked automatically
    nitro(),
    viteReact(),
    ...swInClientBuildOnly(
      VitePWA({
        registerType: "autoUpdate",
        outDir: staticOutDir,
        injectRegister: false,
        devOptions: {
          enabled: false,
        },
        manifest: {
          name: "Ledger — Personal Finance",
          short_name: "Ledger",
          description:
            "Track income, expenses, and savings with a beautiful real-time finance dashboard.",
          theme_color: "#064e3b",
          background_color: "#0a0f0d",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "/maskable-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          // Pages are server-rendered, so there is no index.html to fall back to.
          // Use the network for pages, and the last copy seen when offline.
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 20 },
              },
            },
          ],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
      }),
    ),
  ],
});
