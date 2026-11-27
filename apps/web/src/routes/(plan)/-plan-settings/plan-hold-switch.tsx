import { Card, Switch, Text } from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { planAtom } from "#/state/derived.ts";
import { togglePlanHoldAtom } from "#/state/plan-operations.ts";
import { useSaveSettingsChange } from "./settings-shared.ts";

/** Holds the plan, or releases it: a held plan is left out of the other plans' calculation. */
export function PlanHoldSwitch({ planId }: { planId: string }) {
  const plan = useAtomValue(planAtom(planId));
  const toggle = useSetAtom(togglePlanHoldAtom);
  const save = useSaveSettingsChange(planId);
  if (!plan) return null;
  return (
    <Card.Root as="section" aria-label="保留">
      <Card.Body alignItems="stretch">
        <Switch
          colorScheme="primary"
          checked={plan.onHold === true}
          onChange={() => save(toggle({ planId: plan.id }))}
        >
          このプランを保留にする
        </Switch>
        <Text fontSize="xs" color="fg.muted">
          保留中のプランは、ほかのプランの上限や SPU
          に数えません。このプランだけ、保留でないプランを数えたうえで試算します。
        </Text>
      </Card.Body>
    </Card.Root>
  );
}
