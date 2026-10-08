import { createFileRoute, notFound } from "@tanstack/react-router";
import { GuideArticle } from "./-guide-article";
import { loadArticle } from "../../../guides/articles";
import { pageHead } from "../../../page-head";

export const Route = createFileRoute("/(markdown)/guides/$slug")({
  loader: async ({ params }) => {
    const article = await loadArticle(params.slug);
    if (!article) throw notFound();
    return article;
  },
  head: ({ loaderData: article }) =>
    article
      ? pageHead({
          path: `/guides/${article.slug}`,
          title: article.title,
          description: article.description,
          article,
        })
      : {},
  component: function GuidePage() {
    return <GuideArticle article={Route.useLoaderData()} />;
  },
});
