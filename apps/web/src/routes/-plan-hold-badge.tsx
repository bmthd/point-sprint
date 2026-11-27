import { useAtomValue } from "jotai";
import { planOnHoldAtom } from "#/state/derived.ts";
import { Badge } from "@workspaces/ui";

/** 「保留中」 on a held plan, so that it is told from the plans that count; nothing on the others. */
export function PlanHoldBadge({ planId }: { planId: string }) {
  const onHold = useAtomValue(planOnHoldAtom(planId));
  if (!onHold) return null;
  return (
    <Badge variant="outline" colorScheme="gray" fullRounded flex="none">
      保留中
    </Badge>
  );
}
