import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*", "apps/*/vitest.browser.config.ts"],
  },
});
