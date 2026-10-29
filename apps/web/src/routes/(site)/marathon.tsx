import { createFileRoute } from "@tanstack/react-router";
import { MarathonPage } from "./-marathon/marathon-page";
import { marathonDescription, marathonTitle, splitRounds } from "./-marathon/marathon-rounds";
import { loadArticles } from "../../guides/articles";
import { pageHead } from "../../page-head";
import { getMarathonRounds } from "../../server/official-events/marathon-rounds.functions";

/**
 * The marathon's schedule and caps. Rendered by the Worker on each request, not ahead of time, so
 * that its HTML has the rounds collection found since the last deploy.
 */
export const Route = createFileRoute("/(site)/marathon")({
  loader: async () => {
    const [marathon, articles] = await Promise.all([getMarathonRounds(), loadArticles()]);
    return {
      ...marathon,
      guides: articles.map(({ slug, title }) => ({ slug, title })),
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { ahead } = splitRounds(loaderData.rounds, loaderData.today);
    return pageHead({
      path: "/marathon",
      title: marathonTitle(ahead),
      description: marathonDescription(ahead, loaderData.today),
    });
  },
  component: Marathon,
});

function Marathon() {
  return <MarathonPage {...Route.useLoaderData()} />;
}
