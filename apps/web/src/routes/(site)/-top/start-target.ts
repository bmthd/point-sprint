import type { OfficialEvent } from "@workspaces/domain";

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

export type StartTarget = { kind: "create"; event: OfficialEvent } | { kind: "choose" };

/**
 * Where the hero's start button goes. A single running event wins; otherwise the single upcoming
 * one; otherwise the most recently ended one. Anything ambiguous falls back to choosing.
 */
export function startTarget(
  events: OfficialEvent[] | undefined,
  today: string | undefined,
): StartTarget {
  if (events === undefined || today === undefined) return { kind: "choose" };

  const running = events.filter(({ period }) => period.start <= today && today <= period.end);
  const upcoming = events.filter(({ period }) => period.start > today);
  const latestEnded = endedLatestFirst(events, today).slice(0, 1);

  const candidates = [running, upcoming, latestEnded].find((group) => group.length > 0) ?? [];
  const [only, ...rest] = candidates;
  return only !== undefined && rest.length === 0
    ? { kind: "create", event: only }
    : { kind: "choose" };
}
