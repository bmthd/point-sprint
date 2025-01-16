import { ConfirmDialog } from "@/ui/dialog";
import { Operation } from "@/ui/table";
import { Item } from "@/views/top-page/schema";
import { FieldMetadata } from "@conform-to/react";
import { IconButton } from "@yamada-ui/react";
import { CellContext } from "@yamada-ui/table";
import { EllipsisIcon } from "@yamada-ui/lucide";
import { ComponentRef, FC, useCallback, useRef } from "react";

export const DetailButton: FC<CellContext<FieldMetadata<Item>, Operation>> = () => {
  const dialogRef = useRef<ComponentRef<typeof ConfirmDialog>>(null);
  const handleClick = useCallback(async () => {
    await dialogRef.current?.confirm();
  }, []);
  return (
    <>
      <IconButton onClick={handleClick} icon={<EllipsisIcon />} colorScheme="gray" />
      <ConfirmDialog ref={dialogRef} cancelText="閉じる">
        <div>詳細情報</div>
      </ConfirmDialog>
    </>
  );
};
