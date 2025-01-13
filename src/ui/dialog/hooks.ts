import { useCallback, useState } from "react";

type State = {
  isOpen: boolean;
  resolve: (isSuccess: boolean) => void;
};

const initialState: State = {
  isOpen: false,
  resolve: () => {},
};

/**
 * 確認ダイアログの状態管理実装
 */
export const useConfirmState = () => {
  const [{ isOpen, resolve }, setState] = useState<State>(initialState);

  const confirm = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        setState({ isOpen: true, resolve });
      }),
    [],
  );

  const handleSuccess = useCallback(() => {
    resolve(true);
    setState(initialState);
  }, [resolve]);

  const handleCancel = useCallback(() => {
    resolve(false);
    setState(initialState);
  }, [resolve]);

  return {
    /** ダイアログの開閉状態 */
    isOpen,
    /** 確認ダイアログの操作を待機する関数 */
    confirm,
    /** 確認ダイアログのOKボタンを押した時の処理 */
    handleSuccess,
    /** 確認ダイアログのキャンセルボタンを押した時の処理 */
    handleCancel,
  };
};
