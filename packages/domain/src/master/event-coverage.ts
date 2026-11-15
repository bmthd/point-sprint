import type { OfficialEvent } from "#/model/official-event.ts";

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

/**
 * An event Rakuten holds once a year, which the collection is meant to pick up from its page by
 * `due` (`MM-DD`), its `id` starting with `idPrefix`.
 */
export type YearlyEvent = { name: string; idPrefix: string; due: string; until: string };

/**
 * The yearly events that the master lacks this year, from their `due` to their `until` (`MM-DD`,
 * both in `today`'s year): the collection did not pick them up, and the operator has to add them.
 */
export function missingYearlyEvents(
  events: OfficialEvent[],
  yearly: readonly YearlyEvent[],
  today: string,
): YearlyEvent[] {
  const year = today.slice(0, 4);
  return yearly.filter(
    ({ idPrefix, due, until }) =>
      `${year}-${due}` <= today &&
      today <= `${year}-${until}` &&
      !events.some((event) => event.id.startsWith(idPrefix) && event.period.start.startsWith(year)),
  );
}
