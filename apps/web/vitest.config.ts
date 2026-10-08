import { defineConfig } from "vitest/config";
import { ogFonts } from "./og-fonts-plugin.ts";

export default defineConfig({
  plugins: [ogFonts()],
  test: {
    name: "web",
    include: ["src/**/*.test.ts"],
  },
});
