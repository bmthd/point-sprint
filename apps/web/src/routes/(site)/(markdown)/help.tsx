import { createFileRoute } from "@tanstack/react-router";
import markdown from "../../../markdown/help.md?raw";
import { pageHead } from "../../../page-head";
import { MarkdownBody } from "./-markdown-body";

export const Route = createFileRoute("/(site)/(markdown)/help")({
  context: () => ({ markdown }),
  head: () =>
    pageHead({
      path: "/help",
      title: "使い方・注意事項",
      description:
        "ポイントスプリントの使い方と注意事項です。プラン、注文、保留、SPU の初期値の考え方と、データの保存先を説明します。",
    }),
  component: MarkdownBody,
});
