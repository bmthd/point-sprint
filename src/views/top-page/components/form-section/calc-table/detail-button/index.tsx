import { ConfirmDialog } from "@/ui/dialog";
import { Operation } from "@/ui/table";
import { Item } from "@/views/top-page/schema";
import { FieldMetadata } from "@conform-to/react";
import { Button } from "@yamada-ui/react";
import { CellContext } from "@yamada-ui/table";
import { FC, useCallback, useRef } from "react";

export const DetailButton: FC<CellContext<FieldMetadata<Item>, Operation>> = () => {
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
