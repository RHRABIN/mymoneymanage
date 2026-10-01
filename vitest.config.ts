import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so tests don't load the TanStack Start/PWA plugins
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Bangladesh time (UTC+6) makes the UTC-vs-local date bug reproducible
    env: { TZ: "Asia/Dhaka" },
  },
});
