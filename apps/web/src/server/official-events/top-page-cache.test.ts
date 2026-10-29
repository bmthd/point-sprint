import type { OfficialEvent } from "@workspaces/domain";
import { expect, test } from "vitest";
import { type PageCache, cachedTopPage } from "./top-page-cache";

const marathon: OfficialEvent = {
  id: "marathon-2026-10-14",
  name: "お買い物マラソン第二弾",
  period: { start: "2026-10-14", end: "2026-10-17" },
  benefits: [],
};

/** A cache that keeps what it is given, by URL, as `caches.default` does in one data center. */
function memoryCache(): PageCache & { size: () => number } {
  const pages = new Map<string, Response>();
  return {
    size: () => pages.size,
    async match(key) {
      return pages.get(new Request(key).url)?.clone();
    },
    async put(key, response) {
      pages.set(new Request(key).url, response);
    },
  };
}

/** The top page's server: renders the events it reads, and counts the renders. */
function topPageServer({ build = "b1", cache = memoryCache() } = {}) {
  let today = "2026-10-12";
  let events: OfficialEvent[] | Error = [marathon];
  let renders = 0;
  const pending: Promise<unknown>[] = [];
  const read = async () => {
    if (events instanceof Error) throw events;
    return events;
  };
  const get = async (path = "/", init?: RequestInit) => {
    const response = await cachedTopPage({
      request: new Request(`https://point-sprint.example${path}`, init),
      render: async (_request, snapshot) => {
        renders += 1;
        const names =
          snapshot?.kind === "ready" ? snapshot.events.map((event) => event.name).join(",") : "";
        return new Response(`<html>${names}</html>`, { headers: { "set-by": "render" } });
      },
      events: read,
      cache,
      build,
      today,
      waitUntil: (promise) => pending.push(promise),
    });
    await Promise.all(pending);
    return response;
  };
  return {
    get,
    cache,
    renders: () => renders,
    setEvents: (next: OfficialEvent[] | Error) => {
      events = next;
    },
    setToday: (next: string) => {
      today = next;
    },
  };
}

test("renders the top page once and serves it from the cache after that", async () => {
  const server = topPageServer();
  const first = await server.get();
  const second = await server.get();
  expect(await first.text()).toBe("<html>お買い物マラソン第二弾</html>");
  expect(await second.text()).toBe("<html>お買い物マラソン第二弾</html>");
  expect(server.renders()).toBe(1);
  expect(second.headers.get("set-by")).toBe("render");
});

test("tells the browser to ask again each time, whether rendered or cached", async () => {
  const server = topPageServer();
  for (const response of [await server.get(), await server.get()]) {
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
  }
});

test("renders the new events on the first request after they change", async () => {
  const server = topPageServer();
  await server.get();
  server.setEvents([marathon, { ...marathon, id: "brand-day", name: "楽天ブランドデー" }]);
  expect(await (await server.get()).text()).toBe(
    "<html>お買い物マラソン第二弾,楽天ブランドデー</html>",
  );
  // A change within an event, its cap told later for one, is a change too.
  server.setEvents([{ ...marathon, period: { start: "2026-10-14", end: "2026-10-18" } }]);
  await server.get();
  expect(server.renders()).toBe(3);
});

test("renders the page anew on the next day, for the events' statuses on it", async () => {
  const server = topPageServer();
  await server.get();
  server.setToday("2026-10-13");
  await server.get();
  await server.get();
  expect(server.renders()).toBe(2);
});

test("a page of another build is not served", async () => {
  const server = topPageServer();
  await server.get();
  // The same data center: the next build shares its cache.
  const next = topPageServer({ build: "b2", cache: server.cache });
  await next.get();
  expect(next.renders()).toBe(1);
});

test("renders each time, keeping nothing, while the events cannot be read", async () => {
  const server = topPageServer();
  server.setEvents(new Error("D1 is down"));
  await server.get();
  await server.get();
  expect(server.renders()).toBe(2);
  expect(server.cache.size()).toBe(0);
});

test("keeps only GET / without a query", async () => {
  const server = topPageServer();
  await server.get("/?utm_source=x");
  await server.get("/", { method: "HEAD" });
  await server.get("/share");
  expect(server.renders()).toBe(3);
  expect(server.cache.size()).toBe(0);
});

test("renders from the events already read even if the source becomes unavailable", async () => {
  const cache = memoryCache();
  const pending: Promise<unknown>[] = [];
  let reads = 0;
  const get = () =>
    cachedTopPage({
      request: new Request("https://point-sprint.example/"),
      events: async () => {
        reads += 1;
        if (reads > 1) throw new Error("D1 became unavailable");
        return [marathon];
      },
      render: async (_request, snapshot) =>
        new Response(
          snapshot?.kind === "ready"
            ? `${snapshot.today}: ${snapshot.events.map((event) => event.name).join(",")}`
            : "events unavailable",
        ),
      cache,
      build: "b1",
      today: "2026-10-12",
      waitUntil: (promise) => pending.push(promise),
    });
  expect(await (await get()).text()).toBe("2026-10-12: お買い物マラソン第二弾");
  await Promise.all(pending);
  expect(reads).toBe(1);
  expect(cache.size()).toBe(1);
  expect(await (await get()).text()).toBe("events unavailable");
  expect(cache.size()).toBe(1);
});

test("does not retain a failed read and renders events once the source recovers", async () => {
  const server = topPageServer();
  server.setEvents(new Error("D1 is down"));
  expect(await (await server.get()).text()).toBe("<html></html>");
  expect(server.cache.size()).toBe(0);
  server.setEvents([marathon]);
  expect(await (await server.get()).text()).toBe("<html>お買い物マラソン第二弾</html>");
  await server.get();
  expect(server.renders()).toBe(2);
});

test("caches a successfully read empty event list", async () => {
  const server = topPageServer();
  server.setEvents([]);
  expect(await (await server.get()).text()).toBe("<html></html>");
  await server.get();
  expect(server.renders()).toBe(1);
  expect(server.cache.size()).toBe(1);
});

test("renders the snapshot without caching on query requests and HEAD requests", async () => {
  const server = topPageServer();
  for (const response of [
    await server.get("/?utm_source=x"),
    await server.get("/", { method: "HEAD" }),
  ]) {
    expect(await response.text()).toBe("<html>お買い物マラソン第二弾</html>");
  }
  expect(server.cache.size()).toBe(0);
});

test("provides the snapshot when the cache is disabled", async () => {
  const response = await cachedTopPage({
    request: new Request("https://point-sprint.example/"),
    events: async () => [marathon],
    render: (_request, snapshot) => Response.json(snapshot),
    build: "dev",
    today: "2026-10-12",
    waitUntil: () => {
      throw new Error("must not store a page");
    },
  });
  expect(await response.json()).toEqual({ kind: "ready", events: [marathon], today: "2026-10-12" });
});
