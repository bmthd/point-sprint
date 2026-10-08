import { createFileRoute } from "@tanstack/react-router";
import { PlanList } from "./-plan-list/plan-list";
import { pageHead } from "../../page-head";

export const Route = createFileRoute("/(site)/")({
  head: () => pageHead({ path: "/" }),
  component: () => <PlanList />,
});
