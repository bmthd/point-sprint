import { createFileRoute } from "@tanstack/react-router";
import markdown from "./-markdown/help.md?raw";
import { pageHead } from "#/page-head.ts";
import { MarkdownBody } from "./-markdown-body.tsx";

export const Route = createFileRoute("/(site)/(markdown)/help")({
  context: () => ({ markdown }),
  head: () =>
    pageHead({
      path: "/help",
      title: "使い方",
      description:
        "ポイントスプリントの使い方です。プラン、注文、上限、保留、月ごとの SPU の考え方と、ほかの端末との同期、計算の誤差を説明します。",
    }),
  component: MarkdownBody,
});
