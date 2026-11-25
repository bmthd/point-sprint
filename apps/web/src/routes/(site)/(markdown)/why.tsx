import { createFileRoute } from "@tanstack/react-router";
import markdown from "./-markdown/why.md?raw";
import { pageHead } from "#/page-head.ts";
import { MarkdownBody } from "./-markdown-body.tsx";

export const Route = createFileRoute("/(site)/(markdown)/why")({
  context: () => ({ markdown }),
  head: () =>
    pageHead({
      path: "/why",
      title: "なぜポイントスプリントか？",
      description:
        "楽天のポイント計算ツール8件を調べて、ポイントスプリントと比べました。注文ごとの計算、複数プランの保存、保留や並べ替えなど、ポイントスプリントの特徴と、ほかのツールが優れているところをまとめます。",
    }),
  component: MarkdownBody,
});
