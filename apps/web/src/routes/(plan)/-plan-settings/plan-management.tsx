import { useNavigate } from "@tanstack/react-router";
import {
  Button,
  Card,
  Heading,
  Modal,
  Separator,
  Switch,
  Text,
  useDisclosure,
} from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { runDeletePlanAtom } from "#/state/mutations.ts";
import { planAtom } from "#/state/derived.ts";
import { togglePlanHoldAtom } from "#/state/plan-operations.ts";
import { useSaveSettingsChange } from "./settings-shared.ts";

/**
 * 「プランの管理」, last in the settings: holding the plan, which leaves it out of the other plans'
 * calculation, and deleting it, after asking. The plan's pages are gone with it, so deleting goes
 * to the top page, where the remaining plans are listed, before the plan leaves.
 */
export function PlanManagement({ planId }: { planId: string }) {
  const plan = useAtomValue(planAtom(planId));
  const toggle = useSetAtom(togglePlanHoldAtom);
  const save = useSaveSettingsChange(planId);
  const deletePlan = useSetAtom(runDeletePlanAtom);
  const navigate = useNavigate();
  const { open, onOpen, onClose } = useDisclosure();
  if (!plan) return null;
  return (
    <Card.Root as="section" aria-label="プランの管理">
      <Card.Body alignItems="stretch" gap="3">
        <Heading as="h2" fontSize="md">
          プランの管理
        </Heading>
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
        <Separator />
        <Button variant="outline" colorScheme="danger" alignSelf="start" onClick={onOpen}>
          このプランを削除
        </Button>
        <Text fontSize="xs" color="fg.muted">
          このプランと、その注文がすべて消えます。この操作は取り消せません。
        </Text>
        <Modal.Root
          open={open}
          title="プランを削除しますか？"
          body={
            <Text>「{plan.name}」と、その注文はすべて消えます。この操作は取り消せません。</Text>
          }
          cancel="キャンセル"
          success={{ children: "削除する", colorScheme: "danger" }}
          onClose={onClose}
          onCancel={onClose}
          onSuccess={() => {
            onClose();
            void navigate({ to: "/" }).then(() => deletePlan(planId));
          }}
        />
      </Card.Body>
    </Card.Root>
  );
}
