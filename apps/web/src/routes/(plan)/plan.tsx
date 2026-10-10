import { createFileRoute } from "@tanstack/react-router";
import { useHydrateAtoms } from "jotai/utils";
import { itemLookupAtom } from "./-item-autofill";
import { PlanHome } from "./-plan-home/plan-home";
import { workerItemLookup } from "./-worker-item-lookup";
import { planSearchSchema } from "../../planSearch";
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
  validateSearch: planSearchSchema,
  component: PlanRoute,
});

function PlanRoute() {
  useHydrateAtoms([[itemLookupAtom, { lookup: workerItemLookup }]]);
  const { id } = Route.useSearch();
  return <PlanHome id={id} />;
}
