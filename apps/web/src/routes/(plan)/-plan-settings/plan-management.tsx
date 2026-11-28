import { useNavigate } from "@tanstack/react-router";
import { Button, Card, Heading, Modal, Separator, Switch, Text } from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { selectAtom } from "jotai/utils";
import { type Plan } from "@workspaces/domain";
import { planAtom } from "#/state/derived.ts";
import { runDeletePlanAtom } from "#/state/mutations.ts";
import { togglePlanHoldAtom } from "#/state/plan-operations.ts";
import { useSaveSettingsChange } from "./settings-shared.ts";

/** 「プランの管理」, last in the settings: holding the plan, and deleting it. */
export function PlanManagement({ planId }: { planId: string }) {
  return (
    <Card.Root as="section" aria-label="プランの管理">
      <Card.Body alignItems="stretch" gap="3">
        <Heading as="h2" fontSize="md">
          プランの管理
        </Heading>
        <PlanHoldSwitch planId={planId} />
        <Separator />
        <DeletePlan planId={planId} />
      </Card.Body>
    </Card.Root>
  );
}

/** Holds the plan, or releases it: a held plan is left out of the other plans' calculation. */
function PlanHoldSwitch({ planId }: { planId: string }) {
  const onHold = useAtomValue(selectAtom(planAtom(planId), isOnHold));
  const toggle = useSetAtom(togglePlanHoldAtom);
  const save = useSaveSettingsChange(planId);
  return (
    <>
      <Switch colorScheme="primary" checked={onHold} onChange={() => save(toggle({ planId }))}>
        このプランを保留にする
      </Switch>
      <Text fontSize="xs" color="fg.muted">
        保留中のプランは、ほかのプランの上限や SPU
        に数えません。このプランだけ、保留でないプランを数えたうえで試算します。
      </Text>
    </>
  );
}

/**
 * Deletes the plan, after asking. The plan's pages are gone with it, so it goes to the top page,
 * where the remaining plans are listed, before the plan leaves.
 */
function DeletePlan({ planId }: { planId: string }) {
  const name = useAtomValue(selectAtom(planAtom(planId), planName));
  const deletePlan = useSetAtom(runDeletePlanAtom);
  const navigate = useNavigate();
  return (
    <>
      <Modal.Root
        title="プランを削除しますか？"
        body={<Text>「{name}」と、その注文はすべて消えます。この操作は取り消せません。</Text>}
        cancel="キャンセル"
        success={{ children: "削除する", colorScheme: "danger" }}
        onSuccess={(onClose) => {
          onClose();
          void navigate({ to: "/" }).then(() => deletePlan(planId));
        }}
      >
        <Modal.OpenTrigger>
          <Button variant="outline" colorScheme="danger" alignSelf="start">
            このプランを削除
          </Button>
        </Modal.OpenTrigger>
      </Modal.Root>
      <Text fontSize="xs" color="fg.muted">
        このプランと、その注文がすべて消えます。この操作は取り消せません。
      </Text>
    </>
  );
}

const isOnHold = (plan: Plan | undefined) => plan?.onHold === true;
const planName = (plan: Plan | undefined) => plan?.name;
