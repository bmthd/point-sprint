import { createFileRoute } from "@tanstack/react-router";
import { MarkdownPage } from "../features/site-info/markdown-page";
import source from "../features/site-info/terms.md?raw";
import { pageHead } from "../page-head";

export const Route = createFileRoute("/terms")({
  head: () =>
    pageHead({
      path: "/terms",
      title: "利用規約",
      description:
        "ポイントスプリントの利用規約です。サービスの提供、利用者の責任、禁止事項、免責事項などを定めます。",
    }),
  component: () => <MarkdownPage source={source} />,
});
