import { createFileRoute } from "@tanstack/react-router";
import { getGuide } from "../../../../guides/guide.functions";
import { thumbnailAlt, thumbnailPath } from "../../../../guides/thumbnail";
import { pageHead } from "../../../../page-head";
import { GuideArticle } from "./-guide-article";

export const Route = createFileRoute("/(site)/(markdown)/guides/$slug")({
  loader: ({ params }) => getGuide({ data: params.slug }),
  head: ({ loaderData }) =>
    loaderData
      ? pageHead({
          path: `/guides/${loaderData.article.slug}`,
          title: loaderData.article.title,
          description: loaderData.article.description,
          article: loaderData.article,
          image: {
            path: thumbnailPath(loaderData.article.slug),
            alt: thumbnailAlt(loaderData.article),
          },
        })
      : {},
  component: GuidePage,
});

function GuidePage() {
  return <GuideArticle guide={Route.useLoaderData()} />;
}
