import { createFileRoute } from "@tanstack/react-router";
import { Profile } from "./-profile/profile";
import { pageHead } from "../../page-head";
import { syncServer } from "../-sync-server";

export const Route = createFileRoute("/(plan)/profile")({
  head: () =>
    pageHead({
      path: "/profile",
      title: "プロフィール",
      description:
        "ほかの端末との同期と、よく買うショップの登録をします。楽天アカウントを使い分けるときは、アカウントもここで登録します。",
    }),
  component: () => <Profile syncServer={syncServer} />,
});
