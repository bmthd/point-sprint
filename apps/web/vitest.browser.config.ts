import viteReact from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [viteReact({ compiler: true })],
  // Found only after the first test files load, Vite optimizes these mid-run and reloads the
  // tests, which then fail to import.
  optimizeDeps: {
    include: [
      "@tanstack/react-query",
      "jotai",
      "jotai/utils",
      "jotai-family",
      "jotai-tanstack-query",
      "jotai-tanstack-query/react",
      "ky",
      "seitu/web/indexed-db",
      "seitu/web/indexed-db-table",
    ],
  },
  test: {
    name: "web-browser",
    include: ["src/**/*.browser.test.tsx"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
