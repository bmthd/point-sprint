import { FC, useCallback, useMemo, useRef, ComponentRef } from "react";
import { Button, Input, Text } from "@yamada-ui/react";
import { ListPlusIcon, RotateCcwIcon } from "@yamada-ui/lucide";
import { Item, initializeItem } from "../../../schema";
import { ConfirmDialog } from "@/ui/dialog";

/* Footer Components */
type HeaderComponent<T> = FC<HeaderContext<FieldMetadata<T>, Operation<T>>>;

export const AddRowButton: HeaderComponent<Item> = ({ table }) => {
  const handleClick = useCallback(() => table.options.meta?.add?.(initializeItem()), [table]);
  return (
    <Button onClick={handleClick} startIcon={<ListPlusIcon fontSize="2xl" />} w="full">
      行追加
    </Button>
  );
};

export const TotalPointDisplay: HeaderComponent<Item> = ({ table }) => {
  const total = useMemo(() => {
    const data = table.options.data;
    return data.reduce((acc, row) => {
      const field = row.getFieldset();
      return acc + 0;
    }, 0);
  }, [table]);
  return <Input value={total} readOnly />;
};

export const AddAdditionalRateButton: HeaderComponent<Item> = ({ table }) => {
  const handleClick = useCallback(() => table.options.meta?.add?.(), [table]);
  return <Button onClick={handleClick}>追加</Button>;
};

export const ResetButton: HeaderComponent<Item> = ({ table }) => {
  const dialogRef = useRef<ComponentRef<typeof ConfirmDialog>>(null);
  const handleClick = useCallback(async () => {
    const isConfirm = await dialogRef.current?.confirm();
    if (!isConfirm) return;
    table.options.meta?.reset?.();
  }, []);
  return (
    <>
      <Button onClick={handleClick} startIcon={<RotateCcwIcon />} colorScheme="danger">
        リセット
      </Button>
      <ConfirmDialog ref={dialogRef} cancelText="キャンセル">
        <Text>テーブルのすべての入力値を初期化します。</Text>
        <Text>よろしいですか？</Text>
      </ConfirmDialog>
    </>
  );
};
