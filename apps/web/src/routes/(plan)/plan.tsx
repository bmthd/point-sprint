import { createFileRoute } from "@tanstack/react-router";
import { PlanHome } from "./-plan-home/plan-home";
import { PlanSearchSchema } from "./-plan-search";
import { pageHead } from "../../page-head";

export const Route = createFileRoute("/(plan)/plan")({
  head: () =>
    pageHead({
      path: "/plan",
      title: "プラン",
      description:
        "お買い物マラソンで買う予定の注文を並べて、獲得できるポイントと還元率を計算します。",
      noindex: true,
    }),
  validateSearch: PlanSearchSchema,
  component: PlanRoute,
});

function PlanRoute() {
  const { id } = Route.useSearch();
  return <PlanHome id={id} />;
}
