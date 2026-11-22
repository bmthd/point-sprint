import { type OfficialEvent, selectStartEvent } from "@workspaces/domain";

export type StartTarget = { kind: "create"; event: OfficialEvent } | { kind: "choose" };

/** Translate the event selection into the hero button's action; missing data opens the chooser. */
export function startTarget(
  events: OfficialEvent[] | undefined,
  today: string | undefined,
): StartTarget {
  if (events === undefined || today === undefined) return { kind: "choose" };
  const event = selectStartEvent(events, today);
  return event === undefined ? { kind: "choose" } : { kind: "create", event };
}
