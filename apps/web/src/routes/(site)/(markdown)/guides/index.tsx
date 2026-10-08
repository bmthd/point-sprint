import { createFileRoute } from "@tanstack/react-router";
import { GuideList } from "./-guide-list";
import { loadArticles } from "../../../../guides/articles";
import { pageHead } from "../../../../page-head";

export const Route = createFileRoute("/(site)/(markdown)/guides/")({
  loader: () => loadArticles(),
  head: () =>
    pageHead({
      path: "/guides",
      title: "買い物ガイド",
      description:
        "楽天市場のお買い物マラソンで何を買うか迷ったときの買い物ガイドです。1000円ポッキリの商品など、目的ごとに楽天市場の商品を紹介します。",
    }),
  component: function GuideListPage() {
    return <GuideList articles={Route.useLoaderData()} />;
  },
});
