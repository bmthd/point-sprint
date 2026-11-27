import { selectAtom } from "jotai/utils";
import { type Plan, deepEqual } from "@workspaces/domain";
import { planAtom } from "#/state/derived.ts";
import { Modal, Text, useDisclosure } from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { type RefObject, useRef, useState } from "react";

import { removeBenefitAtom } from "#/state/plan-operations.ts";
import { useSaveSettingsChange } from "./settings-shared.ts";

/**
 * The confirmation before deleting a campaign the user added. After deleting, focus goes to
 * `afterDelete`, since the button that opened it is gone; after cancelling it goes back to that
 * button.
 */
export function useDeleteCampaign(planId: string, afterDelete: RefObject<HTMLElement | null>) {
  const removeBenefit = useSetAtom(removeBenefitAtom);
  const save = useSaveSettingsChange(planId);
  const { open, onOpen, onClose } = useDisclosure();
  const [target, setTarget] = useState<string>();
  const finalFocus = useRef<HTMLElement | null>(null);

  const benefit = useAtomValue(selectAtom(planAtom(planId), benefitById(target ?? ""), deepEqual));
  const ask = (benefitId: string) => {
    setTarget(benefitId);
    finalFocus.current = null;
    onOpen();
  };
  const dialog = (
    <Modal.Root
      open={open}
      title="キャンペーンを削除しますか？"
      body={<Text>「{benefit?.label}」がこのプランから消えます。この操作は取り消せません。</Text>}
      cancel="キャンセル"
      success={{ children: "削除する", colorScheme: "danger" }}
      finalFocusRef={finalFocus}
      onClose={onClose}
      onCancel={onClose}
      onSuccess={() => {
        if (target) save(removeBenefit({ planId: planId, benefitId: target }));
        onClose();
        finalFocus.current = afterDelete.current;
      }}
    />
  );
  return { ask, dialog };
}

const benefitById = (benefitId: string) => (plan: Plan | undefined) =>
  plan?.benefits.find((benefit) => benefit.id === benefitId);
