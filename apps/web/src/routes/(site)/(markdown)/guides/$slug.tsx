import { createFileRoute } from "@tanstack/react-router";
import { getGuide } from "#/guides/guide.functions.ts";
import { thumbnailAlt, thumbnailPath } from "#/guides/thumbnail.ts";
import { operatorName, pageHead } from "#/page-head.ts";
import { siteUrl } from "#/site-url.ts";
import { GuideArticle } from "./-guide-article.tsx";

export const Route = createFileRoute("/(site)/(markdown)/guides/$slug")({
  loader: ({ params }) => getGuide({ data: params.slug }),
  head: ({ loaderData }) =>
    loaderData
      ? {
          ...pageHead({
            path: `/guides/${loaderData.article.slug}`,
            title: loaderData.article.title,
            description: loaderData.article.description,
            article: loaderData.article,
            image: {
              path: thumbnailPath(loaderData.article.slug),
              alt: thumbnailAlt(loaderData.article),
            },
          }),
          scripts: [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: loaderData.article.title,
                datePublished: loaderData.article.published,
                dateModified: loaderData.article.updated ?? loaderData.article.published,
                author: { "@type": "Person", name: operatorName, url: `${siteUrl}/about` },
              }),
            },
          ],
        }
      : {},
  component: GuidePage,
});

function GuidePage() {
  return <GuideArticle guide={Route.useLoaderData()} />;
}
