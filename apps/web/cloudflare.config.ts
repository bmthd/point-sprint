import { bindings, defineConfig } from "cf/config";

export default defineConfig({
  accountId: "1bd734449be302ba9bc4666fae027135",
  worker: {
    name: "point-sprint",
    compatibilityDate: "2026-10-01",
    observability: { enabled: true },
    entrypoint: "@tanstack/react-start/server-entry",
    env: {
      // Mail to the operator from the inquiry form. Email Routing sends only to its verified
      // addresses; the address is the secret `INQUIRY_TO_ADDRESS`, so it is not written here.
      // The sender is `INQUIRY_FROM` (src/server/inquiry-mail.ts). A module imported here cannot
      // be loaded by the dev server's Worker, so it is written out.
      INQUIRY_EMAIL: bindings.sendEmail({ allowedSenderAddresses: ["inquiry@bmth.dev"] }),
      // Secrets, read from the environment by `pnpm dev` and `vite preview` (`.env.development`
      // through dotenvx). A build does not carry them: the deployed Worker gets them in plan 4.
      TURNSTILE_SECRET_KEY: bindings.secret(),
      INQUIRY_TO_ADDRESS: bindings.secret(),
    },
  },
});
