import { QueryClient, HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { PlanList } from "./-plan-list/plan-list";
import { pageHead, siteName } from "../../page-head";
import { siteUrl } from "../../site-url";
import { queryKeys } from "../../state/queries";

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

/** The page starts from the events it was rendered with: the query has them before it runs. */
function TopPage() {
  return (
    <HydrationBoundary state={Route.useLoaderData()}>
      <PlanList />
    </HydrationBoundary>
  );
}

/**
 * The published events, as the query's state, for the page the Worker renders. Nothing when the
 * event master cannot be read, so that the page loads them as it does on the client, where the
 * query reads `/events.json` itself.
 */
const renderedEvents = createIsomorphicFn()
  .server(async () => {
    // Handler imports: see ../../../../../docs/server-imports.md.
    const [{ env }, { publishedEvents }, { devMigrated }] = await Promise.all([
      import("cloudflare:workers"),
      import("../../server/official-events/event-store"),
      import("../../server/shared/dev-migrations.worker"),
    ]);
    try {
      const client = new QueryClient();
      client.setQueryData(
        queryKeys.officialEvents,
        await publishedEvents(await devMigrated(env.EVENTS_DB)),
      );
      return dehydrate(client);
    } catch (error) {
      console.error("The top page is rendered without the events", error);
      return undefined;
    }
  })
  .client(() => undefined);
