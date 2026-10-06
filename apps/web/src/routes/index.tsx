import { createFileRoute } from "@tanstack/react-router";
import { PlanList } from "../features/plan-list/plan-list";

export const Route = createFileRoute("/")({
  component: () => <PlanList />,
});
