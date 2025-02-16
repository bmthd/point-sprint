import { Button, Container, Dialog, HStack } from "@yamada-ui/react";
import {
  type ComponentPropsWithoutRef,
  type FC,
  type ReactNode,
  type Ref,
  useImperativeHandle,
} from "react";
import { useConfirmState } from "../hooks";

type ConfirmDialogProps = {
  /** ConfirmDialogのインスタンスを保持するRef */
  ref: Ref<{ confirm: () => Promise<boolean> }>;
  /** キャンセルボタンのテキスト */
  cancelText?: ReactNode;
  /** OKボタンのテキスト */
  successText?: ReactNode;
} & Omit<
  ComponentPropsWithoutRef<typeof Dialog>,
  "isOpen" | "onClose" | "success" | "cancel" | "onSuccess" | "onCancel"
>;

/**
 * 確認ダイアログ
 * 親要素からconfirm関数を呼び出すことで、ダイアログを表示し、OK/キャンセルの選択を待機する
 * コンポーネントのProps経由でcancelText、successText、childrenに表示するメッセージを指定することができる
 */
export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  ref,
  cancelText,
  successText = "OK",
  children,
  ...props
}) => {
  const { isOpen, confirm, handleSuccess, handleCancel } = useConfirmState();
  useImperativeHandle(ref, () => ({ confirm }), [confirm]);

  return (
    <Dialog maxWidth="80%" as="dialog" onClose={handleCancel} {...{ isOpen }} {...props}>
      <Container>{children}</Container>
      <HStack justify="end" width="full">
        {cancelText && (
          <Button maxWidth="10rem" variant="outline" onClick={handleCancel}>
            {cancelText}
          </Button>
        )}
        <Button maxWidth="10rem" onClick={handleSuccess}>
          {successText}
        </Button>
      </HStack>
    </Dialog>
  );
};
