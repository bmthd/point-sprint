import { type ExecutionContext, env } from "cloudflare:workers";
import { tokyoToday } from "../../ui/dates";
import { publishedEvents } from "./event-store";
import { cachedTopPage } from "./top-page-cache";

/**
 * The top page through the data center's cache (top-page-cache.ts). The dev server renders it each
 * time: its build stays the same while the code changes.
 */
export async function topPageFromCache(
  request: Request,
  ctx: ExecutionContext,
  render: (request: Request) => Response | Promise<Response>,
): Promise<Response> {
  if (import.meta.env.DEV) return render(request);
  return cachedTopPage({
    request,
    render,
    events: () => publishedEvents(env.EVENTS_DB),
    cache: caches.default,
    build: import.meta.env.BUILD_ID ?? "",
    today: tokyoToday(new Date()),
    waitUntil: (promise) => ctx.waitUntil(promise),
  });
}
