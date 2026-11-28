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
 * An event Rakuten holds on about the same days every year, which the collection is meant to pick
 * up from its page by `due` (`MM-DD`), its `id` starting with `idPrefix`. An event held several
 * times a year, like 楽天スーパーSALE, has one for each.
 */
export type YearlyEvent = { name: string; idPrefix: string; due: string; until: string };

/**
 * The yearly events that the master lacks this year, from their `due` to their `until` (`MM-DD`,
 * both in `today`'s year), as no event of theirs overlaps those days: the collection did not pick
 * them up, and the operator has to add them.
 */
export function missingYearlyEvents(
  events: OfficialEvent[],
  yearly: readonly YearlyEvent[],
  today: string,
): YearlyEvent[] {
  const year = today.slice(0, 4);
  return yearly.filter(({ idPrefix, due, until }) => {
    const [from, to] = [`${year}-${due}`, `${year}-${until}`];
    return (
      from <= today &&
      today <= to &&
      !events.some(
        (event) =>
          event.id.startsWith(idPrefix) && event.period.start <= to && from <= event.period.end,
      )
    );
  });
}
