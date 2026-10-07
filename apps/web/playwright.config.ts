import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// Runs against the production build, served by `vite preview`: `pnpm build` first.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    // 1280px: the desktop list with its inline add form.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `pnpm exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    // Empty, so the inquiry stops at its config and never reaches Turnstile or Email Routing.
    env: { TURNSTILE_SECRET_KEY: "", INQUIRY_TO_ADDRESS: "" },
  },
});
