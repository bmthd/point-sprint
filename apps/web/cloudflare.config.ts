import { defineConfig } from "cf/config";

export default defineConfig({
  accountId: "1bd734449be302ba9bc4666fae027135",
  worker: {
    name: "point-sprint",
    compatibilityDate: "2026-10-01",
    observability: { enabled: true },
    entrypoint: "@tanstack/react-start/server-entry",
  },
});
