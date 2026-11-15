// Fails when no official event the site serves is still running a week from today in Japan, when a
// yearly event is not served by its due date, or when the site does not serve them, so the Event
// master workflow opens an issue: the collection from Rakuten's pages has stopped working
// (docs/event-master.md). Run by Node, which strips the types.
import {
  type YearlyEvent,
  eventMasterRunsOut,
  missingYearlyEvents,
} from "#/master/event-coverage.ts";
import type { OfficialEvent } from "#/model/official-event.ts";

const url = process.env.EVENTS_URL ?? "https://point-sprint.bmth.dev/events.json";
const leadDays = 7;
/**
 * Collected from their pages once a year (docs/event-master.md). Black Friday's page has shown the
 * year's campaign from its entry, which opened on 11-18 at the latest in 2020〜2026, and the
 * campaign ended on 11-27 at the latest.
 */
const yearly: YearlyEvent[] = [
  { name: "ブラックフライデー", idPrefix: "black-friday-", due: "11-19", until: "11-27" },
];
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const response = await fetch(url);
if (!response.ok) {
  console.error(`${url} が ${response.status} を返しました。`);
  process.exit(1);
}
const events = (await response.json()) as OfficialEvent[];
const lastEnd =
  events
    .map((event) => event.period.end)
    .sort()
    .at(-1) ?? "なし";

const problems: string[] = [];
if (eventMasterRunsOut(events, today, leadDays)) {
  problems.push(
    `${today} から ${leadDays} 日後まで続く公式イベントが ${url} にありません（最後の終了日: ${lastEnd}）。トップページは終了していないイベントだけを出すため、このままでは「開催中・開催予定のイベント」が空になります。`,
  );
}
for (const missing of missingYearlyEvents(events, yearly, today)) {
  problems.push(
    `今年の${missing.name}が ${url} にありません。例年はこの時期までに告知が出ています。告知ページの作りが変わって読めていないおそれがあります。`,
  );
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`${today} の時点で、公開中のイベントは ${lastEnd} まであります。`);
