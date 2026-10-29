import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";
import { type ExecutionContext, type ScheduledController, env } from "cloudflare:workers";
import { collectEvents } from "./server/official-events/collect-events";
import { devMigrated } from "./server/shared/dev-migrations.worker";
import { d1EventStore } from "./server/official-events/event-store";
import { topPageFromCache } from "./server/official-events/top-page-cache.worker";

// The Worker's entry (`entrypoint` in cloudflare.config.ts): Start's default handler, with the top
// page kept in the cache until the events change, the cron that collects the official events
// (`triggers` there), and the Durable Object classes the Worker exports (`exports` there).

export { RakutenRateGate } from "./server/item-lookup/rakuten-rate-gate.worker";

const start = createServerEntry({ fetch: createStartHandler(defaultStreamHandler) });

export default {
  fetch(request: Request, _env: unknown, ctx: ExecutionContext) {
    return topPageFromCache(request, ctx, (rendered, topPage) =>
      start.fetch(rendered, { context: { topPage } }),
    );
  },
  scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(
      devMigrated(env.EVENTS_DB).then((db) => collectEvents({ store: d1EventStore(db) })),
    );
  },
};
