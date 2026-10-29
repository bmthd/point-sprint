import { QueryClient, HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { PlanList } from "./-plan-list/plan-list";
import { pageHead, siteName } from "../../page-head";
import { siteUrl } from "../../site-url";
import { queryKeys } from "../../state/queries";
import { tokyoToday } from "../../ui/dates";

export const Route = createFileRoute("/(site)/")({
  head: () => ({
    ...pageHead({ path: "/" }),
    // The name search results show for the site. Google reads it from the top page only.
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: siteName,
          url: `${siteUrl}/`,
        }),
      },
    ],
  }),
  loader: () => renderedEvents(),
  component: TopPage,
});

/**
 * The page starts from the events and the day it was rendered with: the query has the events before
 * it runs, and the events' statuses and tabs stay where they were rendered.
 */
function TopPage() {
  const { events, today } = Route.useLoaderData();
  return (
    <HydrationBoundary state={events}>
      <PlanList renderedToday={today} />
    </HydrationBoundary>
  );
}

/**
 * The published events, as the query's state, and today in Japan, for the page the Worker renders.
 * No events when the event master cannot be read, so that the page loads them as it does on the
 * client, where the query reads `/events.json` itself and the browser's today is known.
 */
const renderedEvents = createIsomorphicFn()
  .server(async () => {
    // Handler imports: see ../../../../../docs/server-imports.md.
    const [{ env }, { publishedEvents }, { devMigrated }] = await Promise.all([
      import("cloudflare:workers"),
      import("../../server/official-events/event-store"),
      import("../../server/shared/dev-migrations.worker"),
    ]);
    const today = tokyoToday(new Date());
    try {
      const client = new QueryClient();
      client.setQueryData(
        queryKeys.officialEvents,
        await publishedEvents(await devMigrated(env.EVENTS_DB)),
      );
      return { events: dehydrate(client), today };
    } catch (error) {
      console.error("The top page is rendered without the events", error);
      return { events: undefined, today };
    }
  })
  .client(() => ({ events: undefined, today: undefined }));
