import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";
import { type ExecutionContext, type ScheduledController, env } from "cloudflare:workers";
import { collectEvents } from "./server/collect-events";
import { devMigrated } from "./server/dev-migrations";
import { d1EventStore } from "./server/event-store";

// The Worker's entry (`entrypoint` in cloudflare.config.ts): Start's default handler, the cron that
// collects the official events (`triggers` there), and the Durable Object classes the Worker
// exports (`exports` there).

export { RakutenRateGate } from "./server/rakuten-rate-gate";

export default {
  ...createServerEntry({ fetch: createStartHandler(defaultStreamHandler) }),
  scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(
      devMigrated(env.EVENTS_DB).then((db) => collectEvents({ store: d1EventStore(db) })),
    );
  },
};
