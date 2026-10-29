import { createFileRoute, redirect } from "@tanstack/react-router";

// 共通設定 was at `/profile`: bookmarks of it still reach the page.
export const Route = createFileRoute("/(plan)/profile")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", replace: true });
  },
});
