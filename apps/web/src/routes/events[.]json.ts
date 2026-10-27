import { createFileRoute } from "@tanstack/react-router";

/**
 * The published official events, read by the pages and by the Event master workflow, which checks
 * that one still runs a week from now (.github/workflows/event-master.yml).
 */
export const Route = createFileRoute("/events.json")({
  server: {
    handlers: {
      GET: async () => {
        // Handler imports: see ../../../../docs/server-imports.md.
        const [{ env }, { publishedEvents }, { devMigrated }] = await Promise.all([
          import("cloudflare:workers"),
          import("../server/official-events/event-store"),
          import("../server/shared/dev-migrations.worker"),
        ]);
        return Response.json(await publishedEvents(await devMigrated(env.EVENTS_DB)), {
          // The cron changes the rows a few times a day at most.
          headers: { "cache-control": "public, max-age=300" },
        });
      },
    },
  },
});
