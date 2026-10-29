import { type OfficialEvent, OfficialEventSchema } from "@workspaces/domain";
import * as v from "valibot";
import type { D1Database } from "cloudflare:workers";
import type { EventStore } from "./collect-events";
import type { EventStatus, StoredEvent } from "./event-collection";

// The event master in D1 (migrations/0001_official_events.sql).

type Row = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  period_start_time: string | null;
  period_end_time: string | null;
  benefits_json: string;
  source_url: string;
  status: EventStatus;
  locked: number;
};

/** The row as an event, or `undefined` when it is not one: a row fixed by hand may be wrong. */
function eventOf(row: Row): OfficialEvent | undefined {
  let benefits: unknown;
  try {
    benefits = JSON.parse(row.benefits_json);
  } catch {
    return undefined;
  }
  const parsed = v.safeParse(OfficialEventSchema, {
    id: row.id,
    name: row.name,
    period: { start: row.period_start, end: row.period_end },
    ...(row.period_start_time && row.period_end_time
      ? { times: { start: row.period_start_time, end: row.period_end_time } }
      : {}),
    benefits,
  });
  if (parsed.success) return parsed.output;
  console.error(`official_events ${row.id} is not an event`, v.flatten(parsed.issues));
  return undefined;
}

/** The published events, the earliest first. */
export async function publishedEvents(db: D1Database): Promise<OfficialEvent[]> {
  const { results } = await db
    .prepare("SELECT * FROM official_events WHERE status = 'published' ORDER BY period_start, id")
    .all<Row>();
  // Only served: collection compares the stored events with the ones it builds, which have no page.
  return results.flatMap((row) => {
    const event = eventOf(row);
    return event ? [{ ...event, url: row.source_url }] : [];
  });
}

/**
 * When collection last read Rakuten's pages, as an ISO timestamp: the latest run that did not fail.
 * `undefined` before the first.
 */
export async function lastCheckedAt(db: D1Database): Promise<string | undefined> {
  const row = await db
    .prepare("SELECT MAX(started_at) AS at FROM collection_runs WHERE outcome <> 'failed'")
    .first<{ at: string | null }>();
  return row?.at ?? undefined;
}

export function d1EventStore(db: D1Database): EventStore {
  return {
    async stored() {
      const { results } = await db.prepare("SELECT * FROM official_events").all<Row>();
      const rows = new Map<string, StoredEvent>();
      for (const row of results) {
        const event = eventOf(row);
        // A row that is not an event is left to the operator, as a locked one is.
        if (event) rows.set(row.id, { event, status: row.status, locked: row.locked === 1 });
        else console.error(`official_events ${row.id} is skipped`);
      }
      return rows;
    },

    async write(writes, fetchedAt) {
      if (writes.length === 0) return;
      // `locked` is checked again here, in case the operator locked the row during the run.
      const upsert = db.prepare(`
        INSERT INTO official_events
          (id, name, period_start, period_end, period_start_time, period_end_time, benefits_json,
           source_url, fetched_at, status, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?9, ?10, ?5, ?6, ?7, ?8, ?7)
        ON CONFLICT (id) DO UPDATE SET
          name = excluded.name,
          period_start = excluded.period_start,
          period_end = excluded.period_end,
          period_start_time = excluded.period_start_time,
          period_end_time = excluded.period_end_time,
          benefits_json = excluded.benefits_json,
          source_url = excluded.source_url,
          fetched_at = excluded.fetched_at,
          status = excluded.status,
          updated_at = excluded.updated_at
        WHERE official_events.locked = 0 AND official_events.status <> 'rejected'`);
      await db.batch(
        writes.map(({ event, status, sourceUrl }) =>
          upsert.bind(
            event.id,
            event.name,
            event.period.start,
            event.period.end,
            JSON.stringify(event.benefits),
            sourceUrl,
            fetchedAt,
            status,
            event.times?.start ?? null,
            event.times?.end ?? null,
          ),
        ),
      );
    },

    async logRun({ startedAt, outcome, message, sourceHash }) {
      await db
        .prepare(
          "INSERT INTO collection_runs (started_at, outcome, message, source_hash) VALUES (?, ?, ?, ?)",
        )
        .bind(startedAt, outcome, message, sourceHash ?? null)
        .run();
    },
  };
}
