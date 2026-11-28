import type { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { type ReadPages, collectEvents } from "./collect-events.ts";
import { MARATHON_URL } from "./event-pages.ts";
import { d1EventStore, lastCheckedAt, publishedEvents } from "./event-store.ts";
import { memoryD1 } from "#/server/shared/memory-d1.ts";

/**
 * October 2026's rounds, read while the marathon page showed the second one. The Black Friday page
 * and the 楽天スーパーSALE page are not served.
 */
const readPages = async (): Promise<ReadPages> => ({
  schedule: {
    read: [
      {
        title: "第一弾",
        period: { start: "2026-10-04", end: "2026-10-09" },
        times: { start: "20:00", end: "01:59" },
      },
      {
        title: "第二弾",
        period: { start: "2026-10-14", end: "2026-10-17" },
        times: { start: "20:00", end: "09:59" },
      },
      {
        title: "第三弾",
        period: { start: "2026-10-24", end: "2026-10-27" },
        times: { start: "20:00", end: "09:59" },
      },
    ],
  },
  marathon: {
    read: {
      campaignName: "お買い物マラソン",
      period: { start: "2026-10-14", end: "2026-10-17" },
      times: { start: "20:00", end: "09:59" },
      maxRate: 10,
      cap: 7000,
    },
  },
  blackFriday: { error: "HTTP 503" },
  supersale: { error: "HTTP 503" },
  sourceHash: "0".repeat(64),
});
/** What every run here notes: the Black Friday page and the 楽天スーパーSALE page are not served. */
const NO_CAMPAIGN_PAGES =
  "ブラックフライデーのページを取得できない（HTTP 503）\nスーパーSALE のページを取得できない（HTTP 503）";

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
  expect(await collectEvents({ store: d1EventStore(db), readPages, now })).toBe("ok");
  // The second round already had the cap the page shows, and the third keeps the one it had.
  expect(runs(sqlite)).toEqual([{ outcome: "ok", message: NO_CAMPAIGN_PAGES }]);

  sqlite.exec(
    `UPDATE official_events SET benefits_json = replace(benefits_json, '"cap":7000', '"cap":5000')
     WHERE id = 'marathon-2026-10-14'`,
  );
  await collectEvents({ store: d1EventStore(db), readPages, now });
  expect(runs(sqlite).at(-1)).toEqual({
    outcome: "ok",
    message: `marathon-2026-10-14: 更新\n${NO_CAMPAIGN_PAGES}`,
  });
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
  const unread = async (): Promise<ReadPages> => ({
    ...(await readPages()),
    schedule: { error: "HTTP 503" },
  });
  expect(await collectEvents({ store: d1EventStore(db), readPages: unread })).toBe("failed");
  expect(runs(sqlite)).toEqual([
    { outcome: "failed", message: "スケジュールのページを取得できない（HTTP 503）" },
  ]);
});

test("the last check is the latest run that did not fail", async () => {
  const { db, sqlite } = memoryD1();
  expect(await lastCheckedAt(db)).toBeUndefined();
  sqlite.exec(
    `INSERT INTO collection_runs (started_at, outcome, message) VALUES
       ('2026-10-28T19:05:00.000Z', 'ok', '変更なし'),
       ('2026-10-29T01:05:00.000Z', 'warning', '上限が 500'),
       ('2026-10-29T07:05:00.000Z', 'failed', 'スケジュールのページを取得できない')`,
  );
  expect(await lastCheckedAt(db)).toBe("2026-10-29T01:05:00.000Z");
});
