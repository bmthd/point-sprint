import type { Benefit, Plan } from "@workspaces/domain";
import { Modal, Text, useDisclosure } from "@workspaces/ui";
import { useSetAtom } from "jotai";
import { type RefObject, useRef, useState } from "react";
import { removeBenefitAtom } from "../../../state/order-ops";
import { useSaveSettingsChange } from "./settings-shared";

/**
 * The confirmation before deleting a campaign the user added. After deleting, focus goes to
 * `afterDelete`, since the button that opened it is gone; after cancelling it goes back to that
 * button.
 */
export function useDeleteCampaign(plan: Plan, afterDelete: RefObject<HTMLElement | null>) {
  const removeBenefit = useSetAtom(removeBenefitAtom);
  const save = useSaveSettingsChange(plan.id);
  const { open, onOpen, onClose } = useDisclosure();
  const [target, setTarget] = useState<Benefit>();
  const finalFocus = useRef<HTMLElement | null>(null);

  const ask = (benefit: Benefit) => {
    setTarget(benefit);
    finalFocus.current = null;
    onOpen();
  };
  const dialog = (
    <Modal.Root
      open={open}
      title="キャンペーンを削除しますか？"
      body={<Text>「{target?.label}」がこのプランから消えます。この操作は取り消せません。</Text>}
      cancel="キャンセル"
      success={{ children: "削除する", colorScheme: "danger" }}
      finalFocusRef={finalFocus}
      onClose={onClose}
      onCancel={onClose}
      onSuccess={() => {
        if (target) save(removeBenefit({ planId: plan.id, benefitId: target.id }));
        onClose();
        finalFocus.current = afterDelete.current;
      }}
    />
  );
  return { ask, dialog };
}
