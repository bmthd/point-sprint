import { createFileRoute } from "@tanstack/react-router";
import markdown from "../../../markdown/privacy.md?raw";
import { pageHead } from "../../../page-head";
import { MarkdownBody } from "./-markdown-body";

export const Route = createFileRoute("/(site)/(markdown)/privacy")({
  context: () => ({ markdown, surface: "paper" as const }),
  head: () =>
    pageHead({
      path: "/privacy",
      title: "プライバシーポリシー",
      description:
        "ポイントスプリントのプライバシーポリシーです。Google アナリティクス・Google AdSense の Cookie と外部送信、お問い合わせの情報の取り扱いを説明します。",
    }),
  component: MarkdownBody,
});
