import { createFileRoute } from "@tanstack/react-router";
import { Profile } from "./-profile/profile";
import { pageHead } from "../../page-head";

export const Route = createFileRoute("/(plan)/profile")({
  head: () =>
    pageHead({
      path: "/profile",
      title: "プロフィール",
      description:
        "SPU（スーパーポイントアッププログラム）の達成状況と、よく買うショップを登録します。新しく作るプランの初期値になります。",
    }),
  component: () => <Profile />,
});
