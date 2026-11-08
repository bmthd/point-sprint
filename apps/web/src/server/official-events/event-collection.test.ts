import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  type StoredEvent,
  checkEvent,
  collectMarathon,
  marathonEvent,
} from "./event-collection.ts";

const fixture = (name: string) =>
  readFileSync(new URL(`event-pages/${name}`, import.meta.url), "utf8");
const scheduleHtml = fixture("schedule-2026-10.html");
const marathonHtml = fixture("marathon-2026-10-14.html");

const idSequence = () => {
  let next = 0;
  return () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
};

/** The shop-around's id in the row already stored. */
const KEPT = "b0000000-0000-4000-8000-0000000000aa";

const second = {
  title: "第二弾",
  period: { start: "2026-10-14", end: "2026-10-17" },
  times: { start: "20:00", end: "09:59" },
};
const third = {
  title: "第三弾",
  period: { start: "2026-10-24", end: "2026-10-27" },
  times: { start: "20:00", end: "09:59" },
};

const published = (event: StoredEvent["event"]): StoredEvent => ({
  event,
  status: "published",
  locked: false,
});

const collect = (
  options: {
    today?: string;
    marathon?: { html: string } | { error: string };
    stored?: Map<string, StoredEvent>;
  } = {},
) =>
  collectMarathon({
    scheduleHtml,
    marathon: options.marathon ?? { html: marathonHtml },
    today: options.today ?? "2026-10-15",
    stored: options.stored ?? new Map(),
    newId: idSequence(),
  });

test("publishes the round on the marathon page with its cap, and the next one without", () => {
  const { writes, outcome } = collect();
  expect(outcome).toBe("ok");
  expect(writes).toEqual([
    {
      event: marathonEvent({
        round: second,
        maxRate: 10,
        cap: 7000,
        benefitId: "00000000-0000-4000-8000-000000000001",
      }),
      status: "published",
      sourceUrl: "https://event.rakuten.co.jp/campaign/point-up/marathon/",
    },
    {
      event: marathonEvent({
        round: third,
        maxRate: 10,
        cap: undefined,
        benefitId: "00000000-0000-4000-8000-000000000002",
      }),
      status: "published",
      sourceUrl: "https://event.rakuten.co.jp/campaign/point-up/marathon/schedule/",
    },
  ]);
});

test("a round is an event whose shop-around pays +1〜+9倍 at 2〜10 shops over its period", () => {
  const event = marathonEvent({ round: second, maxRate: 10, cap: 7000, benefitId: KEPT });
  expect(event.id).toBe("marathon-2026-10-14");
  expect(event.name).toBe("お買い物マラソン第二弾");
  expect(event.period).toEqual(second.period);
  expect(event.times).toEqual({ start: "20:00", end: "09:59" });
  const [benefit] = event.benefits;
  expect(benefit?.sharedKey).toBe(event.id);
  expect(benefit?.conditions.dateRule).toEqual({ type: "range", ...second.period });
  if (benefit?.kind !== "shop-around") throw new Error("no shop-around");
  expect(benefit.params.tiers.at(0)).toEqual({ minShops: 2, rate: 1 });
  expect(benefit.params.tiers.at(-1)).toEqual({ minShops: 10, rate: 9 });
  expect(benefit.params.cap).toBe(7000);
});

test("leaves out rounds that have ended", () => {
  const { writes } = collect({ today: "2026-10-18" });
  expect(writes.map((write) => write.event.id)).toEqual(["marathon-2026-10-24"]);
});

test("writes nothing for a round that has not changed, and keeps its benefit id", () => {
  const event = marathonEvent({ round: second, maxRate: 10, cap: 7000, benefitId: KEPT });
  const stored = new Map([[event.id, published(event)]]);
  const { writes } = collect({ stored });
  expect(writes.map((write) => write.event.id)).toEqual(["marathon-2026-10-24"]);

  const changed = marathonEvent({ round: second, maxRate: 10, cap: 5000, benefitId: KEPT });
  const update = collect({ stored: new Map([[event.id, published(changed)]]) }).writes[0];
  expect(update?.event).toEqual(event);
});

test("keeps the cap read from the marathon page once the page has moved on", () => {
  const event = marathonEvent({ round: second, maxRate: 10, cap: 7000, benefitId: KEPT });
  const { writes } = collect({
    marathon: { html: "<p>終了しました</p>" },
    stored: new Map([[event.id, published(event)]]),
  });
  expect(writes.map((write) => write.event.id)).toEqual(["marathon-2026-10-24"]);
});

test("leaves rows the operator fixed or turned down", () => {
  const event = marathonEvent({ round: second, maxRate: 10, cap: 5000, benefitId: KEPT });
  const stored = new Map<string, StoredEvent>([
    [event.id, { event, status: "published", locked: true }],
    ["marathon-2026-10-24", { event, status: "rejected", locked: false }],
  ]);
  const { writes, notes } = collect({ stored });
  expect(writes).toEqual([]);
  expect(notes).toEqual([
    "marathon-2026-10-14: 固定されているので更新しない",
    "marathon-2026-10-24: 却下されているので更新しない",
  ]);
});

test("does not publish a round that fails the checks, and keeps the one published", () => {
  const html = marathonHtml.replace(">7,000ポイント(期間限定)", ">700,000ポイント(期間限定)");
  const before = marathonEvent({ round: second, maxRate: 10, cap: 7000, benefitId: KEPT });
  const kept = collect({ marathon: { html }, stored: new Map([[before.id, published(before)]]) });
  expect(kept.outcome).toBe("warning");
  expect(kept.writes.map((write) => write.event.id)).toEqual(["marathon-2026-10-24"]);
  expect(kept.notes).toContain("marathon-2026-10-14: 上限が 700000");

  const fresh = collect({ marathon: { html } });
  expect(fresh.writes[0]).toMatchObject({
    status: "pending",
    event: { id: "marathon-2026-10-14" },
  });
});

test("does not take the marathon page's round when it overlaps a round on the schedule page", () => {
  const html = marathonHtml.replace("2026年10月14日(水)20:00", "2026年10月13日(火)20:00");
  const { writes, outcome, notes } = collect({ marathon: { html } });
  expect(outcome).toBe("warning");
  expect(notes).toContain(
    "マラソンのページの期間 2026-10-13〜2026-10-17 がスケジュールのページにない",
  );
  // Both rounds go in from the schedule page, without a cap.
  expect(writes.map((write) => write.sourceUrl)).toEqual([
    "https://event.rakuten.co.jp/campaign/point-up/marathon/schedule/",
    "https://event.rakuten.co.jp/campaign/point-up/marathon/schedule/",
  ]);
});

// On 2026-11-03 the marathon page showed November's first round while the schedule page still
// listed October's rounds.
const marathonAheadHtml = fixture("marathon-2026-11-04.html");
const ahead = {
  title: "&ジャンル祭",
  period: { start: "2026-11-04", end: "2026-11-11" },
  times: { start: "20:00", end: "01:59" },
};
const aheadEvent = (benefitId: string) =>
  marathonEvent({ round: ahead, maxRate: 10, cap: 7000, benefitId });

test("publishes the marathon page's round that the schedule page does not list yet", () => {
  const { writes, outcome, notes } = collect({
    marathon: { html: marathonAheadHtml },
    today: "2026-11-03",
  });
  expect(outcome).toBe("ok");
  expect(writes).toEqual([
    {
      event: aheadEvent("00000000-0000-4000-8000-000000000001"),
      status: "published",
      sourceUrl: "https://event.rakuten.co.jp/campaign/point-up/marathon/",
    },
  ]);
  expect(writes[0]?.event.name).toBe("お買い物マラソン&ジャンル祭");
  expect(notes).toContain(
    "marathon-2026-11-04: スケジュールのページにまだない回を、マラソンのページから追加",
  );
});

test("names the round from the schedule page once it lists the round, keeping its ids", () => {
  const scheduleHtml = `
    <div class="marathonCalender-title"><span>第一弾!</span></div>
    <p class="marathonCalender-lead">2026年11月4日(水) 20:00 ～ 2026年11月11日(水) 01:59</p>`;
  const stored = new Map([["marathon-2026-11-04", published(aheadEvent(KEPT))]]);
  const { writes, outcome } = collectMarathon({
    scheduleHtml,
    marathon: { html: marathonAheadHtml },
    today: "2026-11-05",
    stored,
    newId: idSequence(),
  });
  expect(outcome).toBe("ok");
  expect(writes).toEqual([
    {
      event: marathonEvent({
        round: { ...ahead, title: "第一弾" },
        maxRate: 10,
        cap: 7000,
        benefitId: KEPT,
      }),
      status: "published",
      sourceUrl: "https://event.rakuten.co.jp/campaign/point-up/marathon/",
    },
  ]);
});

test("writes nothing for the round ahead of the schedule page once it is stored", () => {
  const stored = new Map([["marathon-2026-11-04", published(aheadEvent(KEPT))]]);
  const { writes } = collect({
    marathon: { html: marathonAheadHtml },
    today: "2026-11-03",
    stored,
  });
  expect(writes).toEqual([]);
});

test("leaves the round ahead of the schedule page when the operator fixed or turned it down", () => {
  for (const row of [
    { event: aheadEvent(KEPT), status: "published", locked: true },
    { event: aheadEvent(KEPT), status: "rejected", locked: false },
  ] satisfies StoredEvent[]) {
    const { writes, notes } = collect({
      marathon: { html: marathonAheadHtml },
      today: "2026-11-03",
      stored: new Map([["marathon-2026-11-04", row]]),
    });
    expect(writes).toEqual([]);
    expect(notes).toContain(
      `marathon-2026-11-04: ${row.locked ? "固定" : "却下"}されているので更新しない`,
    );
  }
});

test("holds back the round ahead of the schedule page when it fails the checks", () => {
  const html = marathonAheadHtml.replace(">7,000ポイント(期間限定)", ">700,000ポイント(期間限定)");
  const { writes, outcome, notes } = collect({ marathon: { html }, today: "2026-11-03" });
  expect(outcome).toBe("warning");
  expect(notes).toContain("marathon-2026-11-04: 上限が 700000");
  expect(writes).toMatchObject([{ status: "pending", event: { id: "marathon-2026-11-04" } }]);
});

test("goes on from the schedule page when the marathon page cannot be fetched", () => {
  const { writes, outcome, notes } = collect({ marathon: { error: "HTTP 503" } });
  expect(outcome).toBe("warning");
  expect(notes).toContain("マラソンのページを取得できない（HTTP 503）");
  expect(writes).toHaveLength(2);
});

test("fails without writing when the schedule page has no rounds", () => {
  const result = collectMarathon({
    scheduleHtml: "<p>メンテナンス中</p>",
    marathon: { html: marathonHtml },
    today: "2026-10-15",
    stored: new Map(),
    newId: idSequence(),
  });
  expect(result).toEqual({
    writes: [],
    outcome: "failed",
    notes: ["スケジュールのページから回を読めない"],
  });
});

test("checks the period, the rate and the cap", () => {
  const ok = marathonEvent({ round: second, maxRate: 10, cap: 7000, benefitId: KEPT });
  expect(checkEvent(ok)).toEqual([]);
  const long = { title: "第一弾", period: { start: "2026-10-01", end: "2026-10-20" } };
  expect(
    checkEvent(marathonEvent({ round: long, maxRate: 10, cap: 7000, benefitId: KEPT })),
  ).toEqual(["期間が 20 日"]);
  expect(
    checkEvent(marathonEvent({ round: second, maxRate: 30, cap: 500, benefitId: KEPT })),
  ).toEqual(["倍率が最大 30 倍", "上限が 500"]);
});
