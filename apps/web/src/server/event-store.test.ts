import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Database, D1PreparedStatement } from "cloudflare:workers";
import { expect, test } from "vitest";
import { collectEvents } from "./collect-events";
import { MARATHON_URL, SCHEDULE_URL } from "./event-pages";
import { d1EventStore, publishedEvents } from "./event-store";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** D1 over SQLite in memory, with the migrations applied: the part of its API the store uses. */
function memoryD1(): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  const migrations = new URL("../../migrations/", import.meta.url);
  for (const file of readdirSync(migrations).toSorted()) {
    if (file.endsWith(".sql")) sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
  }
  const statement = (query: string, values: unknown[] = []): D1PreparedStatement => ({
    bind: (...next) => statement(query, next),
    all: async <T>() => ({ results: sqlite.prepare(query).all(...(values as never[])) as T[] }),
    run: async () => sqlite.prepare(query).run(...(values as never[])),
  });
  return {
    sqlite,
    db: {
      prepare: (query) => statement(query),
      batch: async (statements) => {
        for (const each of statements) await each.run();
      },
    },
  };
}

const pages: Record<string, string> = {
  [SCHEDULE_URL]: read("event-pages/schedule-2026-10.html"),
  [MARATHON_URL]: read("event-pages/marathon-2026-10-14.html"),
};
const fetchPages = (async (url: string) =>
  pages[url] === undefined
    ? new Response("", { status: 503 })
    : new Response(pages[url])) as typeof fetch;

const runs = (sqlite: DatabaseSync) =>
  sqlite.prepare("SELECT outcome, message FROM collection_runs ORDER BY id").all();

test("serves the events the migrations put in, the earliest first", async () => {
  const { db } = memoryD1();
  const events = await publishedEvents(db);
  expect(events.map((event) => event.id)).toEqual([
    "marathon-2026-10",
    "marathon-2026-10-14",
    "brand-day-2026-10-20",
    "marathon-2026-10-24",
  ]);
  expect(events[0]?.name).toBe("お買い物マラソン&ジャンル祭");
  expect(events[0]?.times).toEqual({ start: "20:00", end: "01:59" });
  expect(events[2]?.times).toBeUndefined();
});

test("a run confirms the round on the marathon page and logs what it did", async () => {
  const { db, sqlite } = memoryD1();
  // 2026-10-15 12:00 in Japan, while the second round runs.
  const now = () => new Date("2026-10-15T03:00:00Z");
  expect(await collectEvents({ store: d1EventStore(db), fetch: fetchPages, now })).toBe("ok");
  // The second round already had the cap the page shows, and the third keeps the one it had.
  expect(runs(sqlite)).toEqual([{ outcome: "ok", message: "変更なし" }]);

  sqlite.exec(
    `UPDATE official_events SET benefits_json = replace(benefits_json, '"cap":7000', '"cap":5000')
     WHERE id = 'marathon-2026-10-14'`,
  );
  await collectEvents({ store: d1EventStore(db), fetch: fetchPages, now });
  expect(runs(sqlite).at(-1)).toEqual({ outcome: "ok", message: "marathon-2026-10-14: 更新" });
  const row = sqlite
    .prepare("SELECT source_url, fetched_at, status FROM official_events WHERE id = ?")
    .get("marathon-2026-10-14");
  expect(row).toEqual({
    source_url: MARATHON_URL,
    fetched_at: "2026-10-15T03:00:00.000Z",
    status: "published",
  });
  const second = (await publishedEvents(db)).find((event) => event.id === "marathon-2026-10-14");
  expect(second?.benefits[0]).toMatchObject({
    id: "fc7a45a2-5bd9-49ee-a9e7-6104109bd30d",
    params: { cap: 7000 },
  });
});

test("does not write over a row the operator locked", async () => {
  const { db, sqlite } = memoryD1();
  sqlite.exec(
    `UPDATE official_events SET locked = 1,
       benefits_json = replace(benefits_json, '"cap":7000', '"cap":5000')
     WHERE id = 'marathon-2026-10-14'`,
  );
  const store = d1EventStore(db);
  const event = (await store.stored()).get("marathon-2026-10-14")?.event;
  if (!event) throw new Error("no row");
  // Written as if the row was locked after the run read it.
  await store.write(
    [{ event: { ...event, name: "上書き" }, status: "published", sourceUrl: MARATHON_URL }],
    "2026-10-15T03:00:00.000Z",
  );
  const kept = await publishedEvents(db);
  expect(kept.find((each) => each.id === "marathon-2026-10-14")?.name).toBe(
    "お買い物マラソン第二弾",
  );
});

test("serves no row that is not published or not an event", async () => {
  const { db, sqlite } = memoryD1();
  sqlite.exec(`UPDATE official_events SET status = 'rejected' WHERE id = 'marathon-2026-10'`);
  sqlite.exec(`UPDATE official_events SET benefits_json = '[' WHERE id = 'marathon-2026-10-24'`);
  const events = await publishedEvents(db);
  expect(events.map((event) => event.id)).toEqual(["marathon-2026-10-14", "brand-day-2026-10-20"]);
  expect(events.map((event) => event.url)).toEqual([
    "https://event.rakuten.co.jp/campaign/point-up/marathon/schedule/",
    "https://event.rakuten.co.jp/brand/campaign/",
  ]);
});

test("logs a failed run without writing when the schedule page cannot be fetched", async () => {
  const { db, sqlite } = memoryD1();
  const fetchNothing = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
  expect(await collectEvents({ store: d1EventStore(db), fetch: fetchNothing })).toBe("failed");
  expect(runs(sqlite)).toEqual([
    { outcome: "failed", message: "スケジュールのページを取得できない（HTTP 503）" },
  ]);
});
