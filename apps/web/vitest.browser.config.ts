import viteReact from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { guideItems } from "./src/guides/vite-plugin.ts";

export default defineConfig({
  // The guides' lists have no items in tests: no test calls the Rakuten API.
  plugins: [viteReact({ compiler: true }), guideItems({ search: undefined })],
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
