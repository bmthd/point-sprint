import { defineConfig } from "vitest/config";
import { ogFonts } from "./og-fonts-plugin.ts";
import { gitArticleDates } from "#/guides/git-dates.ts";

export default defineConfig({
  plugins: [ogFonts()],
  define: { "import.meta.env.GUIDE_DATES": JSON.stringify(gitArticleDates()) },
  test: {
    name: "web",
    include: ["src/**/*.test.ts", "lint/**/*.test.ts"],
  },
});
