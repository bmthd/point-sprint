import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "./-settings/settings";
import { pageHead } from "../../page-head";

export const Route = createFileRoute("/(plan)/settings")({
  head: () =>
    pageHead({
      path: "/settings",
      noindex: true,
      title: "共通設定",
      description:
        "すべてのプランに共通する設定です。月ごとの SPU、ほかの端末との同期、よく買うショップ、楽天アカウントの使い分けを設定します。",
    }),
  component: Settings,
});
