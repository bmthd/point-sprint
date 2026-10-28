import {
  type EventWrite,
  type RunOutcome,
  type StoredEvent,
  collectMarathon,
} from "./event-collection";
import { MARATHON_URL, SCHEDULE_URL } from "./event-pages";

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

/**
 * Reads the schedule page and the marathon page, two requests a run, and writes what passes the
 * checks. Every run is logged, with why a round was not published.
 */
export async function collectEvents({
  store,
  fetch = globalThis.fetch,
  now = () => new Date(),
  newId = () => crypto.randomUUID(),
}: {
  store: EventStore;
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  newId?: () => string;
}): Promise<RunOutcome> {
  const startedAt = now().toISOString();
  /** The page, or why it could not be fetched. */
  const get = async (url: string): Promise<{ html: string } | { error: string }> => {
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
      return response.ok ? { html: await response.text() } : { error: `HTTP ${response.status}` };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  };
  const [schedule, marathon] = await Promise.all([get(SCHEDULE_URL), get(MARATHON_URL)]);
  if ("error" in schedule) {
    const message = `スケジュールのページを取得できない（${schedule.error}）`;
    await store.logRun({ startedAt, outcome: "failed", message, sourceHash: undefined });
    return "failed";
  }
  const { writes, outcome, notes } = collectMarathon({
    scheduleHtml: schedule.html,
    marathon,
    today: tokyoDate.format(now()),
    stored: await store.stored(),
    newId,
  });
  await store.write(writes, startedAt);
  await store.logRun({
    startedAt,
    outcome,
    message: notes.join("\n") || "変更なし",
    sourceHash: await sha256(schedule.html + ("html" in marathon ? marathon.html : "")),
  });
  return outcome;
}
