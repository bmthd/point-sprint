import { defineConfig } from "vitest/config";
import { guideItems } from "./src/guides/vite-plugin.ts";

export default defineConfig({
  // The guides' lists have no items in tests: no test calls the Rakuten API.
  plugins: [guideItems({ search: undefined })],
  test: {
    name: "web",
    include: ["src/**/*.test.ts"],
  },
});
