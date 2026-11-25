import type { OfficialEvent } from "#/model/official-event.ts";

/**
 * The events that ended before `today`, the latest first. Ties go to the later start, then to the
 * id, so the event list and the start button agree on which one is the latest.
 */
export function endedLatestFirst(events: OfficialEvent[], today: string): OfficialEvent[] {
  return events
    .filter(({ period }) => period.end < today)
    .toSorted(
      (a, b) =>
        b.period.end.localeCompare(a.period.end) ||
        b.period.start.localeCompare(a.period.start) ||
        a.id.localeCompare(b.id),
    );
}

/**
 * What a plan can be started for: one event, with whether it has `ended`; the `events` to choose
 * from; or `none`.
 */
export type StartEventChoice =
  | { kind: "one"; event: OfficialEvent; ended: boolean }
  | { kind: "many"; events: OfficialEvent[] }
  | { kind: "none" };

/** The running events, else the upcoming ones, else the latest that ended. */
export function startEventChoice(events: OfficialEvent[], today: string): StartEventChoice {
  const running = events.filter(({ period }) => period.start <= today && today <= period.end);
  const upcoming = events.filter(({ period }) => period.start > today);
  const [latestEnded] = endedLatestFirst(events, today);

  const ahead = running.length > 0 ? running : upcoming;
  const [only, ...rest] = ahead;
  if (only !== undefined && rest.length === 0) return { kind: "one", event: only, ended: false };
  if (only !== undefined) return { kind: "many", events: ahead };
  if (latestEnded !== undefined) return { kind: "one", event: latestEnded, ended: true };
  return { kind: "none" };
}
