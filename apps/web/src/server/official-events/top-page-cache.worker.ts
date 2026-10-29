import { type ExecutionContext, env } from "cloudflare:workers";
import { tokyoToday } from "../../ui/dates";
import { publishedEvents } from "./event-store";
import { devMigrated } from "../shared/dev-migrations.worker";
import { type TopPageSnapshot, cachedTopPage } from "./top-page-cache";

/**
 * The top page through the data center's cache (top-page-cache.ts). The dev server renders it each
 * time: its build stays the same while the code changes.
 */
export async function topPageFromCache(
  request: Request,
  ctx: ExecutionContext,
  render: (request: Request, snapshot?: TopPageSnapshot) => Response | Promise<Response>,
): Promise<Response> {
  return cachedTopPage({
    request,
    render,
    events: async () => publishedEvents(await devMigrated(env.EVENTS_DB)),
    cache: import.meta.env.DEV ? undefined : caches.default,
    build: import.meta.env.BUILD_ID ?? "",
    today: tokyoToday(new Date()),
    waitUntil: (promise) => ctx.waitUntil(promise),
  });
}
