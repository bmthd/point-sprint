import { createFileRoute } from "@tanstack/react-router";
import { NoticesPage } from "./-notices/notices-page";
import { pageHead } from "../../page-head";

export const Route = createFileRoute("/(site)/notices")({
  head: () =>
    pageHead({
      path: "/notices",
      title: "お知らせ",
      description: "ポイントスプリントからのお知らせです。新しい機能や変更をお伝えします。",
    }),
  component: () => <NoticesPage />,
});
