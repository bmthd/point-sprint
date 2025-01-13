import { ConfirmDialog } from "@/ui/dialog";
import { Button } from "@yamada-ui/react";
import { FC, useCallback, useRef } from "react";

export const DetailButton: FC = () => {
  const dialogRef = useRef<{ confirm: () => Promise<boolean> } | null>(null);
  const handleClick = useCallback(async () => {
    await dialogRef.current?.confirm();
  }, []);
  return (
    <>
      <Button onClick={handleClick}>詳細</Button>
      <ConfirmDialog ref={dialogRef} cancelText="閉じる">
        <div>詳細情報</div>
      </ConfirmDialog>
    </>
  );
};
