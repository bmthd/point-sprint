import { useNavigate } from "@tanstack/react-router";
import { Button, Modal, Text, VStack, useDisclosure } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { clearDataAtom } from "../state/mutations";

/**
 * 「データを初期化」: after a confirmation, removes the plans, the shops and the profile, and goes to
 * the top as on a first visit. `onDone` runs once the data is gone, before moving.
 */
export function ResetDataButton({ onDone }: { onDone?: () => void }) {
  const { open, onOpen, onClose } = useDisclosure();
  const { mutateAsync: clearData, isPending } = useAtomValue(clearDataAtom);
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  return (
    <VStack gap="2" alignItems="stretch">
      <Button variant="outline" colorScheme="danger" onClick={onOpen}>
        データを初期化
      </Button>
      {failed ? (
        <Text role="alert" fontSize="sm" color="danger.fg">
          初期化できませんでした。もう一度お試しください。
        </Text>
      ) : null}
      <Modal.Root
        open={open}
        title="データを初期化しますか？"
        body={
          <Text>
            プラン・ショップ台帳・プロフィールをすべて消し、初めて開いたときの状態に戻します。元に戻せません。
          </Text>
        }
        cancel="キャンセル"
        success={{ children: "初期化する", colorScheme: "danger", loading: isPending }}
        onClose={onClose}
        onCancel={onClose}
        onSuccess={() => {
          setFailed(false);
          clearData()
            .then(() => {
              onClose();
              onDone?.();
              return navigate({ to: "/" });
            })
            .catch(() => {
              onClose();
              setFailed(true);
            });
        }}
      />
    </VStack>
  );
}
