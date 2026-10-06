import { createFileRoute } from "@tanstack/react-router";
import { PlanHome } from "../features/plan-home/plan-home";
import { planSearchSchema } from "../planSearch";

export const Route = createFileRoute("/plan")({
  validateSearch: planSearchSchema,
  component: PlanRoute,
});

function PlanRoute() {
  const { id } = Route.useSearch();
  return <PlanHome id={id} />;
}
