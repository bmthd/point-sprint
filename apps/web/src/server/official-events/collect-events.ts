import { newId as defaultNewId } from "@workspaces/domain";
import {
  type EventWrite,
  type PageReading,
  type RunOutcome,
  type StoredEvent,
  collectBlackFriday,
  collectMarathon,
  collectSupersale,
} from "./event-collection.ts";
import {
  BLACK_FRIDAY_URL,
  type CurrentRound,
  MARATHON_URL,
  SCHEDULE_URL,
  SUPERSALE_URL,
  type ScheduledRound,
  readCurrentRound,
  readSchedule,
  readShownRounds,
} from "./event-pages.ts";

/** Where the collection keeps the event master (event-store.ts for D1). */
export type EventStore = {
  /** Every row, by event id. */
  stored(): Promise<ReadonlyMap<string, StoredEvent>>;
  write(writes: EventWrite[], fetchedAt: string): Promise<void>;
  logRun(run: {
    startedAt: string;
    outcome: RunOutcome;
    message: string;
    sourceHash: string | undefined;
  }): Promise<void>;
};

// An ordinary browser's, so the pages are served as they are to anyone (decided on 2026-10-09).
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const tokyoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const severity: Record<RunOutcome, number> = { ok: 0, warning: 1, failed: 2 };

/** What a run read from the four pages. */
export type ReadPages = {
  schedule: PageReading<ScheduledRound[]>;
  marathon: PageReading<CurrentRound | undefined>;
  blackFriday: PageReading<CurrentRound[]>;
  supersale: PageReading<CurrentRound[]>;
  /** The SHA-256 of the pages as fetched, so two runs can tell whether the pages changed. */
  sourceHash: string;
};

/**
 * Fetches the schedule page, the marathon page, the Black Friday page and the 楽天スーパーSALE page,
 * four requests a run, and reads them.
 */
async function fetchPages(): Promise<ReadPages> {
  /** The page, or why it could not be fetched. */
  const get = async (url: string): Promise<{ html: string } | { error: string }> => {
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
      return response.ok ? { html: await response.text() } : { error: `HTTP ${response.status}` };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  };
  const fetched = await Promise.all([
    get(SCHEDULE_URL),
    get(MARATHON_URL),
    get(BLACK_FRIDAY_URL),
    get(SUPERSALE_URL),
  ]);
  const [schedule, marathon, blackFriday, supersale] = fetched;
  const read = <T>(
    page: { html: string } | { error: string },
    reader: (html: string) => T,
  ): PageReading<T> => ("error" in page ? page : { read: reader(page.html) });
  return {
    schedule: read(schedule, readSchedule),
    marathon: read(marathon, readCurrentRound),
    blackFriday: read(blackFriday, readShownRounds),
    supersale: read(supersale, readShownRounds),
    sourceHash: await sha256(fetched.map((page) => ("html" in page ? page.html : "")).join("")),
  };
}

/**
 * Reads the pages and writes what passes the checks. Every run is logged, with why an event was not
 * published.
 */
export async function collectEvents({
  store,
  readPages = fetchPages,
  now = () => new Date(),
  newId = defaultNewId,
}: {
  store: EventStore;
  readPages?: () => Promise<ReadPages>;
  now?: () => Date;
  newId?: () => string;
}): Promise<RunOutcome> {
  const startedAt = now().toISOString();
  const { schedule, marathon, blackFriday, supersale, sourceHash } = await readPages();
  if ("error" in schedule) {
    const message = `スケジュールのページを取得できない（${schedule.error}）`;
    await store.logRun({ startedAt, outcome: "failed", message, sourceHash: undefined });
    return "failed";
  }
  const today = tokyoDate.format(now());
  const stored = await store.stored();
  const collections = [
    collectMarathon({ schedule: schedule.read, marathon, today, stored, newId }),
    collectBlackFriday({ page: blackFriday, today, stored, newId }),
    collectSupersale({ page: supersale, today, stored, newId }),
  ];
  const outcome = collections
    .map((collection) => collection.outcome)
    .reduce((worst, each) => (severity[each] > severity[worst] ? each : worst));
  await store.write(
    collections.flatMap((collection) => collection.writes),
    startedAt,
  );
  await store.logRun({
    startedAt,
    outcome,
    message: collections.flatMap((collection) => collection.notes).join("\n") || "変更なし",
    sourceHash,
  });
  return outcome;
}
