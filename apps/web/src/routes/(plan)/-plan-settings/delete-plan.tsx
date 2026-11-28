import { useNavigate } from "@tanstack/react-router";
import { Button, Modal, Text, useDisclosure } from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { selectAtom } from "jotai/utils";
import { type Plan } from "@workspaces/domain";
import { planAtom } from "#/state/derived.ts";
import { runDeletePlanAtom } from "#/state/mutations.ts";

/**
 * Deletes the plan, after asking. The plan's pages are gone with it, so it goes to the top page,
 * where the remaining plans are listed, before the plan leaves.
 */
export function DeletePlan({ planId }: { planId: string }) {
  const name = useAtomValue(selectAtom(planAtom(planId), planName));
  const deletePlan = useSetAtom(runDeletePlanAtom);
  const navigate = useNavigate();
  const { open, onOpen, onClose } = useDisclosure();
  return (
    <>
      <Button variant="outline" colorScheme="danger" alignSelf="start" onClick={onOpen}>
        このプランを削除
      </Button>
      <Modal.Root
        open={open}
        title="プランを削除しますか？"
        body={<Text>「{name}」と、その注文はすべて消えます。この操作は取り消せません。</Text>}
        cancel="キャンセル"
        success={{ children: "削除する", colorScheme: "danger" }}
        onClose={onClose}
        onCancel={onClose}
        onSuccess={() => {
          onClose();
          void navigate({ to: "/" }).then(() => deletePlan(planId));
        }}
      />
    </>
  );
}

const planName = (plan: Plan | undefined) => plan?.name;
