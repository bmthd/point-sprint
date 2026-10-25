import { createFileRoute } from "@tanstack/react-router";
import { Profile } from "./-profile/profile";
import { pageHead } from "../../page-head";

export const Route = createFileRoute("/(plan)/profile")({
  head: () =>
    pageHead({
      path: "/profile",
      title: "プロフィール",
      description:
        "よく買うショップを登録します。楽天アカウントを使い分けるときは、アカウントもここで登録します。",
    }),
  component: () => <Profile />,
});
