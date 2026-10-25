import { createFileRoute } from "@tanstack/react-router";
import { Profile } from "./-profile/profile";
import { pageHead } from "../../page-head";
import { syncServer } from "../-sync-server";

export const Route = createFileRoute("/(plan)/profile")({
  head: () =>
    pageHead({
      path: "/profile",
      title: "共通設定",
      description:
        "すべてのプランに共通する設定です。月ごとの SPU、ほかの端末との同期、よく買うショップ、楽天アカウントの使い分けを設定します。",
    }),
  component: () => <Profile syncServer={syncServer} />,
});
