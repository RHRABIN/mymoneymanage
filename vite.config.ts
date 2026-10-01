import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";

// Where Nitro writes the static files it serves. The service worker must be
// generated there, after the client build, so it can precache the real assets.
const onVercel = !!process.env.VERCEL || process.env.NITRO_PRESET === "vercel";
const staticOutDir = onVercel ? ".vercel/output/static" : ".output/public";

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
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
});
