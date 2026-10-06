import { createFileRoute } from "@tanstack/react-router";
import { PlanSettings } from "../features/plan-settings/plan-settings";
import { planSearchSchema } from "../planSearch";

export const Route = createFileRoute("/plan_/settings")({
  validateSearch: planSearchSchema,
  component: PlanSettingsRoute,
});

function PlanSettingsRoute() {
  const { id } = Route.useSearch();
  return <PlanSettings id={id} />;
}
