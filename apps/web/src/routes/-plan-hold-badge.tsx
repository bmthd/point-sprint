import { selectAtom } from "jotai/utils";
import { type Plan } from "@workspaces/domain";
import { planAtom } from "#/state/derived.ts";
import { useAtomValue } from "jotai";

import { Badge } from "@workspaces/ui";

/** 「保留中」 on a held plan, so that it is told from the plans that count; nothing on the others. */
export function PlanHoldBadge({ planId }: { planId: string }) {
  const onHold = useAtomValue(selectAtom(planAtom(planId), planOnHold));
  if (!onHold) return null;
  return (
    <Badge variant="outline" colorScheme="gray" fullRounded flex="none">
      保留中
    </Badge>
  );
}

const planOnHold = (plan: Plan | undefined) => plan?.onHold ?? false;
