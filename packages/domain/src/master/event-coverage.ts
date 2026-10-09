import type { OfficialEvent } from "../model/official-event";

function addDays(date: string, days: number): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Whether no official event is still running `leadDays` days after `today` (both `YYYY-MM-DD`).
 * The top page lists only events that have not ended, so the next event has to be in the master
 * before then.
 */
export function eventMasterRunsOut(
  events: OfficialEvent[],
  today: string,
  leadDays: number,
): boolean {
  const horizon = addDays(today, leadDays);
  return events.every((event) => event.period.end < horizon);
}
