import type { Plan } from "@workspaces/domain";
import { Badge } from "@workspaces/ui";

/** 「保留中」 on a held plan, so that it is told from the plans that count; nothing on the others. */
export function PlanHoldBadge({ plan }: { plan: Plan }) {
  if (!plan.onHold) return null;
  return (
    <Badge variant="outline" colorScheme="gray" fullRounded flex="none">
      保留中
    </Badge>
  );
}
