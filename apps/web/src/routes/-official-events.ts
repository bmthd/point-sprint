import { queryKeys } from "../state/queries";
import { type OfficialEvent, OfficialEventSchema } from "@workspaces/domain";
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

export const officialEventsQueryAtom = atomWithQuery((get) => {
  const { load } = get(officialEventsSourceAtom);
  // The master changes a few times a day at most.
  return { queryKey: queryKeys.officialEvents, queryFn: load, staleTime: 10 * 60_000 };
});

const noEvents: OfficialEvent[] = [];

/** The events, or none while they load or when they cannot be read. */
export const officialEventsAtom = atom((get) => get(officialEventsQueryAtom).data ?? noEvents);
