import { createFileRoute } from "@tanstack/react-router";
import { NoticeList } from "../features/site-info/notice-list";
import { pageHead } from "../page-head";

export const Route = createFileRoute("/notices")({
  head: () =>
    pageHead({
      path: "/notices",
      title: "お知らせ",
      description: "ポイントスプリントからのお知らせです。機能の追加や変更をお知らせします。",
    }),
  component: () => <NoticeList />,
});
