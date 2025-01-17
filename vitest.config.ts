/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: "./src/test/setup.ts",
    coverage: {
      enabled: !process.env.CI,
      reportsDirectory: "coverage",
    },
    exclude: ["./node_modules/**", "./e2e/**/*"],
  },
  resolve: {
    alias: {
      "@": `${__dirname}/src`,
    },
  },
});
