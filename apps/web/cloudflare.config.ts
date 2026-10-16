import { bindings, defineConfig, exports, triggers } from "cf/config";

const WORKER_NAME = "point-sprint";

// The official event master (migrations/). A Preview runs the pull request's code, so it gets a
// database of its own, never production's. The dev server and the E2E build use a local one.
export const EVENTS_DB = {
  name: "point-sprint-events",
  id: "d98c2865-8429-4255-a212-385567d109b4",
};
export const PREVIEW_EVENTS_DB = {
  name: "point-sprint-events-preview",
  id: "4848acb0-23f2-4f04-85aa-babced7a5ea7",
};

export default defineConfig(({ isPreview }) => ({
  accountId: "1bd734449be302ba9bc4666fae027135",
  worker: {
    name: WORKER_NAME,
    compatibilityDate: "2026-10-01",
    observability: { enabled: true },
    // Start's default entry and the cron's handler, with the Durable Object classes exported next to
    // it.
    entrypoint: "./src/server.ts",
    // Collects the official events from Rakuten's pages (src/server/collect-events.ts) four times a
    // day: 10:05, 16:05, 22:05 and 04:05 in Japan. A round's page goes up around 10:00. A Preview
    // cannot have triggers, so it serves what its database holds.
    ...(isPreview ? {} : { triggers: [triggers.scheduled({ schedule: "5 1,7,13,19 * * *" })] }),
    // The turns at the Rakuten API, shared by every user (src/server/rakuten-rate-gate.ts).
    // SQLite storage, which the Workers Free plan has; the turns are kept in memory only. A Preview
    // cannot create the class, so it has none, and no item lookup.
    exports: isPreview ? {} : { RakutenRateGate: exports.durableObject({ storage: "sqlite" }) },
    env: {
      // Mail to the operator from the inquiry form. Email Routing sends only to its verified
      // addresses; the address is the secret `INQUIRY_TO_ADDRESS`, so it is not written here.
      // The sender is `INQUIRY_FROM` (src/server/inquiry-mail.ts). A module imported here cannot
      // be loaded by the dev server's Worker, so it is written out.
      INQUIRY_EMAIL: bindings.sendEmail({ allowedSenderAddresses: ["inquiry@bmth.dev"] }),
      EVENTS_DB: bindings.d1(isPreview ? PREVIEW_EVENTS_DB : EVENTS_DB),
      ...(isPreview
        ? {}
        : {
            RAKUTEN_RATE_GATE: bindings.durableObject({
              worker: WORKER_NAME,
              exportName: "RakutenRateGate",
            }),
          }),
      // Secrets, read from the environment by `pnpm dev`, `vite preview` and the build's
      // prerendering (`.env.development` and `.env.production` through dotenvx). A build does not
      // carry them: deploy.yml uploads them with each version, so a secret added here must be added
      // to its list too.
      TURNSTILE_SECRET_KEY: bindings.secret(),
      INQUIRY_TO_ADDRESS: bindings.secret(),
      RAKUTEN_APPLICATION_ID: bindings.secret(),
      RAKUTEN_ACCESS_KEY: bindings.secret(),
    },
  },
}));
