import { bindings, defineConfig, exports } from "cf/config";

const WORKER_NAME = "point-sprint";

export default defineConfig(({ isPreview }) => ({
  accountId: "1bd734449be302ba9bc4666fae027135",
  worker: {
    name: WORKER_NAME,
    compatibilityDate: "2026-10-01",
    observability: { enabled: true },
    // Start's default entry, with the Durable Object classes exported next to it.
    entrypoint: "./src/server.ts",
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
