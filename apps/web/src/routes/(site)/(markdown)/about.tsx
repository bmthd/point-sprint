import { createFileRoute } from "@tanstack/react-router";
// The reason in about.md for making the site is a stand-in, until じょうげん writes it (#300).
import markdown from "./-markdown/about.md?raw";
import { pageHead } from "#/page-head.ts";
import { AboutPage } from "./-about/about-page.tsx";
import { getProfile } from "./-about/profile.functions.ts";

export const Route = createFileRoute("/(site)/(markdown)/about")({
  context: () => ({ markdown }),
  loader: () => getProfile(),
  head: ({ loaderData }) => ({
    ...pageHead({
      path: "/about",
      title: "このサイトについて",
      description:
        "ポイントスプリントを作っている人、ソースコード、運営費の出どころ、楽天との関係、データの扱いを説明します。",
    }),
    scripts: loaderData
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "AboutPage",
              mainEntity: {
                "@type": "Person",
                name: loaderData.name.ja,
                url: loaderData.url,
                image: loaderData.avatar[0]?.url,
                sameAs: loaderData.sameAs,
              },
            }),
          },
        ]
      : [],
  }),
  component: AboutRoute,
});

function AboutRoute() {
  return <AboutPage markdown={markdown} profile={Route.useLoaderData()} />;
}
