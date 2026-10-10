import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";

// The Worker's entry (`entrypoint` in cloudflare.config.ts): Start's default handler, and the
// Durable Object classes the Worker exports (`exports` there).

export { RakutenRateGate } from "./server/rakuten-rate-gate";

export default createServerEntry({ fetch: createStartHandler(defaultStreamHandler) });
