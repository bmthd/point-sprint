import type { OfficialEvent } from "@workspaces/domain";

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
  const latestEnded = events
    .filter(({ period }) => period.end < today)
    .reduce<OfficialEvent[]>(
      (latest, event) =>
        latest[0] === undefined || event.period.end > latest[0].period.end ? [event] : latest,
      [],
    );

  const candidates = [running, upcoming, latestEnded].find((group) => group.length > 0) ?? [];
  const [only, ...rest] = candidates;
  return only !== undefined && rest.length === 0
    ? { kind: "create", event: only }
    : { kind: "choose" };
}
