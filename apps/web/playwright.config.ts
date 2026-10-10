import { defineConfig, devices } from "@playwright/test";
import { FAKE_RAKUTEN_API_PORT } from "./e2e/fake-rakuten-api";

const PORT = 4173;

// Runs against the production build, served by `vite preview`: `pnpm build:e2e` first.
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
  webServer: [
    {
      command: `pnpm exec vite preview --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      env: {
        // Empty, so the inquiry stops at its config and never reaches Turnstile or Email Routing.
        TURNSTILE_SECRET_KEY: "",
        INQUIRY_TO_ADDRESS: "",
        // Stand-ins: the item lookup calls the fake API (e2e/fake-rakuten-api.ts).
        RAKUTEN_APPLICATION_ID: "e2e-application-id",
        RAKUTEN_ACCESS_KEY: "e2e-access-key",
      },
    },
    {
      command: "node e2e/fake-rakuten-api.ts",
      url: `http://127.0.0.1:${FAKE_RAKUTEN_API_PORT}/calls`,
      reuseExistingServer: false,
    },
  ],
});
