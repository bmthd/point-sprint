import { createFileRoute } from "@tanstack/react-router";
import { getGuide } from "../../../guides/get-guide";
import { pageHead } from "../../../page-head";
import { GuideArticle } from "./-guide-article";

export const Route = createFileRoute("/(markdown)/guides/$slug")({
  loader: ({ params }) => getGuide({ data: params.slug }),
  head: ({ loaderData }) =>
    loaderData
      ? pageHead({
          path: `/guides/${loaderData.article.slug}`,
          title: loaderData.article.title,
          description: loaderData.article.description,
          article: loaderData.article,
        })
      : {},
  component: function GuidePage() {
    return <GuideArticle guide={Route.useLoaderData()} />;
  },
});
