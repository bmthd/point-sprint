import type { OfficialEvent } from "@workspaces/domain";

// The top page lists the official events, so the Worker renders it on request and keeps what it
// rendered. The cache key holds the build and a digest of the published events: a cron that
// rewrites the events changes the key in every data center at once, which deleting the entry from
// `caches.default` would do only in the cron's own.

/** Where the rendered pages are kept: `caches.default` on the Worker. */
export type PageCache = Pick<Cache, "match" | "put">;

/** How long a data center keeps a rendered page. Its key changes with the events, not with time. */
const STORED_FOR = "public, max-age=86400";

/** What the browser is told: ask again each time, so that the next round shows once it is out. */
const SERVED_WITH = "public, max-age=0, must-revalidate";

async function digest(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function served(response: Response): Response {
  const copy = new Response(response.body, response);
  copy.headers.set("cache-control", SERVED_WITH);
  return copy;
}

/**
 * The top page from `cache`, or rendered by `render` and kept there when the events in its key are
 * new. Only `GET /` without a query is kept; other requests and a page that cannot read the events
 * are rendered each time.
 */
export async function cachedTopPage({
  request,
  render,
  events,
  cache,
  build,
  waitUntil,
}: {
  request: Request;
  render: (request: Request) => Response | Promise<Response>;
  /** The published events. Throws when the event master cannot be read. */
  events: () => Promise<OfficialEvent[]>;
  cache: PageCache;
  /** Tells the builds apart: a page of an earlier build loads scripts that are gone. */
  build: string;
  waitUntil: (promise: Promise<unknown>) => void;
}): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== "/" || url.search !== "") return render(request);
  let version: string;
  try {
    version = await digest(JSON.stringify(await events()));
  } catch (error) {
    console.error("The top page is rendered without its cache", error);
    return render(request);
  }
  const key = new Request(new URL(`/__top-page/${build}/${version}`, url.origin));
  const hit = await cache.match(key);
  if (hit) return served(hit);
  const response = await render(request);
  if (response.status !== 200) return response;
  const stored = new Response(response.clone().body, response);
  stored.headers.set("cache-control", STORED_FOR);
  waitUntil(cache.put(key, stored));
  return served(response);
}
