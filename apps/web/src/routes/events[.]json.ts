import { createFileRoute } from "@tanstack/react-router";

/**
 * The published official events, read by the pages and by the Event master workflow, which checks
 * that one still runs a week from now (.github/workflows/event-master.yml).
 */
export const Route = createFileRoute("/events.json")({
  server: {
    handlers: {
      GET: async () => {
        // Loaded here: they import the Workers runtime, which tests that import the routes lack.
        const [{ env }, { publishedEvents }, { devMigrated }] = await Promise.all([
          import("cloudflare:workers"),
          import("../server/event-store"),
          import("../server/dev-migrations"),
        ]);
        return Response.json(await publishedEvents(await devMigrated(env.EVENTS_DB)), {
          // The cron changes the rows a few times a day at most.
          headers: { "cache-control": "public, max-age=300" },
        });
      },
    },
  },
});
