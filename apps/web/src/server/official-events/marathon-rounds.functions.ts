import { createServerFn } from "@tanstack/react-start";
import { tokyoToday } from "../../ui/dates";

/**
 * The published marathon rounds, the earliest first, with today in Japan and when collection last
 * read Rakuten's pages. Read on each request, so `/marathon` shows a round collected since the last
 * deploy, and its HTML and the page agree on today.
 */
export const getMarathonRounds = createServerFn({ method: "GET" }).handler(async () => {
  // Handler imports: see ../../../../../docs/server-imports.md.
  const [{ env }, { lastCheckedAt, publishedEvents }, { devMigrated }] = await Promise.all([
    import("cloudflare:workers"),
    import("./event-store"),
    import("../shared/dev-migrations.worker"),
  ]);
  const db = await devMigrated(env.EVENTS_DB);
  const [events, checkedAt] = await Promise.all([publishedEvents(db), lastCheckedAt(db)]);
  return {
    today: tokyoToday(new Date()),
    // A round's id is `marathon-<start>` (docs/event-master.md).
    rounds: events.filter((event) => event.id.startsWith("marathon-")),
    checkedAt,
  };
});
