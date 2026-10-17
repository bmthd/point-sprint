// Fails when no official event the site serves is still running a week from today in Japan, or when
// the site does not serve them, so the Event master workflow opens an issue: the collection from
// Rakuten's pages has stopped working (docs/event-master.md). Run by Node, which strips the types.
import { eventMasterRunsOut } from "../src/master/event-coverage.ts";
import type { OfficialEvent } from "../src/model/official-event.ts";

const url = process.env.EVENTS_URL ?? "https://point-sprint.bmth.dev/events.json";
const leadDays = 7;
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

if (eventMasterRunsOut(events, today, leadDays)) {
  console.error(
    `${today} から ${leadDays} 日後まで続く公式イベントが ${url} にありません（最後の終了日: ${lastEnd}）。`,
  );
  process.exit(1);
}
console.log(`${today} の時点で、公開中のイベントは ${lastEnd} まであります。`);
