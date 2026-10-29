import { createFileRoute } from "@tanstack/react-router";
import template from "./-markdown/calculation.md?raw";
import { pageHead } from "../../../page-head";
import { calculationMarkdown } from "./-calculation-markdown";
import { MarkdownBody } from "./-markdown-body";

const markdown = calculationMarkdown(template);

export const Route = createFileRoute("/(site)/(markdown)/calculation")({
  context: () => ({ markdown }),
  head: () =>
    pageHead({
      path: "/calculation",
      title: "計算方法",
      description:
        "ポイントスプリントの計算方法です。計算の流れと、SPU やキャンペーンの倍率と上限を、楽天の公式ページへのリンクと確かめた日とともに載せています。",
    }),
  component: MarkdownBody,
});
