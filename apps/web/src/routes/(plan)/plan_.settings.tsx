import { createFileRoute } from "@tanstack/react-router";
import { PlanSettings } from "./-plan-settings/plan-settings";
import { planSearchSchema } from "../../planSearch";
import { pageHead } from "../../page-head";

export const Route = createFileRoute("/(plan)/plan_/settings")({
  head: () =>
    pageHead({
      path: "/plan/settings",
      title: "プランの設定",
      description: "プランで使う SPU の達成状況、キャンペーン、買いまわりの条件を設定します。",
      noindex: true,
    }),
  validateSearch: planSearchSchema,
  component: PlanSettingsRoute,
});

function PlanSettingsRoute() {
  const { id } = Route.useSearch();
  return <PlanSettings id={id} />;
}
