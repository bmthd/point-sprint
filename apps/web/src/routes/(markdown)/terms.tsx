import { createFileRoute } from "@tanstack/react-router";
import markdown from "../../markdown/terms.md?raw";
import { pageHead } from "../../page-head";
import { MarkdownBody } from "./-markdown-body";

export const Route = createFileRoute("/(markdown)/terms")({
  context: () => ({ markdown }),
  head: () =>
    pageHead({
      path: "/terms",
      title: "利用規約",
      description:
        "ポイントスプリントの利用規約です。サービスの提供、利用者の責任、禁止事項、免責事項などを定めます。",
    }),
  component: MarkdownBody,
});
