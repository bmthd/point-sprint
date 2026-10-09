// Fails when no official event in the master is still running a week from today in Japan, so the
// Event master workflow opens an issue to add the next one. Run by Node, which strips the types.
import { eventMasterRunsOut } from "../src/master/event-coverage.ts";
import { officialEvents } from "../src/master/events.ts";

const leadDays = 7;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const lastEnd =
  officialEvents
    .map((event) => event.period.end)
    .sort()
    .at(-1) ?? "なし";

if (eventMasterRunsOut(officialEvents, today, leadDays)) {
  console.error(
    `${today} から ${leadDays} 日後まで続く公式イベントがマスタにありません（最後の終了日: ${lastEnd}）。`,
  );
  process.exit(1);
}
console.log(`${today} の時点で、マスタのイベントは ${lastEnd} まであります。`);
