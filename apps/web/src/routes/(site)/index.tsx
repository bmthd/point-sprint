import { QueryClient, HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { guideCards } from "./-top/guide-cards";
import { TopPage } from "./-top/top-page";
import { loadArticles } from "../../guides/articles";
import { pageHead, siteName } from "../../page-head";
import { siteUrl } from "../../site-url";
import { queryKeys } from "../../state/queries";
import type { TopPageSnapshot } from "../../server/official-events/top-page-cache";

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
  loader: async ({ serverContext }) => ({
    ...renderedEvents(serverContext?.topPage),
    articles: guideCards(await loadArticles()),
  }),
  component: TopRoute,
});

/**
 * The page starts from the events and the day it was rendered with: the query has the events before
 * it runs, and the events' statuses and tabs stay where they were rendered.
 */
function TopRoute() {
  const { events, today, articles } = Route.useLoaderData();
  return (
    <HydrationBoundary state={events}>
      <TopPage articles={articles} renderedToday={today} />
    </HydrationBoundary>
  );
}

/** Seed the existing query from the same snapshot used to choose the HTML cache key. */
const renderedEvents = createIsomorphicFn()
  .server((snapshot: TopPageSnapshot | undefined) => {
    if (snapshot?.kind !== "ready") return { events: undefined, today: snapshot?.today };
    const client = new QueryClient();
    client.setQueryData(queryKeys.officialEvents, snapshot.events);
    return { events: dehydrate(client), today: snapshot.today };
  })
  .client((_snapshot: TopPageSnapshot | undefined) => ({ events: undefined, today: undefined }));
