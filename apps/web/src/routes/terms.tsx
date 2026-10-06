import { createFileRoute } from "@tanstack/react-router";
import { Terms } from "../features/site-info/terms";
import { pageHead } from "../page-head";

export const Route = createFileRoute("/terms")({
  head: () =>
    pageHead({
      path: "/terms",
      title: "利用規約",
      description:
        "ポイントスプリントの利用規約です。サービスの提供、利用者の責任、禁止事項、免責事項などを定めます。",
    }),
  component: () => <Terms />,
});
