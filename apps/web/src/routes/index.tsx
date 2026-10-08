import { createFileRoute } from "@tanstack/react-router";
import { PlanList } from "../features/plan-list/plan-list";
import { pageHead } from "../page-head";

export const Route = createFileRoute("/")({
  head: () => pageHead({ path: "/" }),
  component: () => <PlanList />,
});
