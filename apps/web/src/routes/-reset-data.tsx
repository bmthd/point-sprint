import { useNavigate } from "@tanstack/react-router";
import { Button, Modal, Text, VStack } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { clearDataAtom } from "#/state/mutations.ts";

/**
 * 「データを初期化」: after a confirmation, removes the plans, the shops and the profile, and goes to
 * the top as on a first visit.
 */
export function ResetDataButton() {
  const { mutateAsync: clearData, isPending } = useAtomValue(clearDataAtom);
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  return (
    <VStack gap="2" alignItems="stretch">
      <Modal.Root
        title="データを初期化しますか？"
        body={
          <Text>
            プラン・ショップ台帳・プロフィールをすべて消し、初めて開いたときの状態に戻します。元に戻せません。
          </Text>
        }
        cancel="キャンセル"
        success={{ children: "初期化する", colorScheme: "danger", loading: isPending }}
        onSuccess={(onClose) => {
          setFailed(false);
          clearData()
            .then(() => {
              onClose();
              return navigate({ to: "/" });
            })
            .catch(() => {
              onClose();
              setFailed(true);
            });
        }}
      >
        <Modal.OpenTrigger>
          <Button variant="outline" colorScheme="danger">
            データを初期化
          </Button>
        </Modal.OpenTrigger>
      </Modal.Root>
      {failed ? (
        <Text role="alert" fontSize="sm" color="danger.fg">
          初期化できませんでした。もう一度お試しください。
        </Text>
      ) : null}
    </VStack>
  );
}
