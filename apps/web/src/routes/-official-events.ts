import { officialEventsQueryOptions } from "./-official-events-query.ts";
import { type OfficialEvent, OfficialEventSchema } from "@workspaces/domain";
import { atomFamily } from "jotai-family";
import { selectAtom } from "jotai/utils";
import { deepEqual, endedLatestFirst } from "@workspaces/domain";
import { atom } from "jotai";
import { atomWithQuery } from "jotai-tanstack-query";
import ky from "ky";
import * as v from "valibot";

// The official events, which the Worker serves from the event master (`/events.json`). The top page
// lists them, and a plan's settings name its event.

/** The published events from the Worker. */
export async function fetchOfficialEvents(): Promise<OfficialEvent[]> {
  return v.parse(v.array(OfficialEventSchema), await ky.get("/events.json").json());
}

/**
 * Where the events come from: the Worker, or what a test gives. Wrapped in an object: an atom made
 * from a function would take it for a getter.
 */
export const officialEventsSourceAtom = atom<{ load: () => Promise<OfficialEvent[]> }>({
  load: fetchOfficialEvents,
});

export const officialEventsQueryAtom = atomWithQuery((get) =>
  officialEventsQueryOptions(get(officialEventsSourceAtom)),
);

const noEvents: OfficialEvent[] = [];

/** The events, or none while they load or when they cannot be read. */
export const officialEventsAtom = atom((get) => get(officialEventsQueryAtom).data ?? noEvents);

export const officialEventAtom = atomFamily((eventId: string) =>
  selectAtom(officialEventsAtom, (events) => events.find((event) => event.id === eventId)),
);

export const officialEventPartitionsAtom = atomFamily((today: string | undefined) =>
  selectAtom(
    officialEventsQueryAtom,
    ({ data, isPending, isError }) => {
      const events = isPending || isError ? [] : data;
      const ahead = today ? events.filter((event) => event.period.end >= today) : events;
      const ended = today ? endedLatestFirst(events, today) : [];
      const [latest, ...earlier] = ended;
      const showEnded = ahead.length === 0 && latest !== undefined;
      const behind = showEnded ? earlier : ended;
      const months = new Map<string, string[]>();
      for (const event of behind) {
        const month = event.period.start.slice(0, 7);
        months.set(month, [...(months.get(month) ?? []), event.id]);
      }
      return {
        showEnded,
        cards: (showEnded ? [latest] : ahead).map(({ id }) => id),
        behind: [...months],
      };
    },
    deepEqual,
  ),
);

export const officialEventsStatusAtom = selectAtom(
  officialEventsQueryAtom,
  ({ isPending, isError, refetch }) => ({ isPending, isError, refetch }),
  deepEqual,
);
