import { ConfirmDialog } from "@/ui/dialog";
import { CustomSwitchField, NumberField, NumberSelectField, TextField } from "@/ui/form";
import { Operation } from "@/ui/table";
import { taxRateMap } from "@/views/top-page/const";
import { FieldMetadata } from "@conform-to/react";
import { EllipsisIcon, GripVerticalIcon, StoreIcon, TrashIcon } from "@yamada-ui/lucide";
import { Button, IconButton, Input } from "@yamada-ui/react";
import { CellContext } from "@yamada-ui/table";
import { ComponentRef, FC, useCallback, useMemo, useRef } from "react";
import { Item } from "../../../schema";

/* Row Components */

type CellComponent<T> = FC<CellContext<FieldMetadata<T>, Operation<T>>>;

/** ドラッグ用のつまみ */
export const DragHandle: FC = () => (
  <IconButton icon={<GripVerticalIcon />} colorScheme="gray" p={0} h="full" h="" />
);

/** 購入店舗数毎のポイントの視覚化と行の計算ロジックへの反映を行うボタン */
export const ShopCountButton: CellComponent<Item> = ({ row }) => {
  const { original, index } = row;
  const field = original.getFieldset();
  const maxPoint = 7000; // TODO
  const tax = 1.1; // TODO

  const buttonDescription = field.active
    ? `${index + 1}行目を計算から除外`
    : `${index + 1}行目を計算に反映`;

  const magnification = index < 10 ? index + 1 : 10;

  const result = useMemo(() => {
    const maxPointPerIndex = index < 9 ? maxPoint / index / 100 : maxPoint / 9 / 100;
    const result = Math.floor(Math.round(maxPointPerIndex * tax * 100) * 100);
    return result === Number.POSITIVE_INFINITY ? "上限なし" : `${result}円`;
  }, [index, maxPoint, tax]);

  const label = `${magnification}倍 ${result}`;

  return (
    <CustomSwitchField name={field.active.name}>
      <Button
        as="div"
        colorScheme={field.active.value ? "red" : "gray"}
        aria-label={buttonDescription}
        title={buttonDescription}
        w="full"
        px={2}
      >
        <StoreIcon />
        {label}
      </Button>
    </CustomSwitchField>
  );
};

/** 商品名入力欄 */
export const NameField: CellComponent<Item> = ({ row }) => {
  const field = row.original.getFieldset();
  return <TextField name={field.name.name} />;
};

/** 価格入力欄 */
export const PriceField: CellComponent<Item> = ({ row }) => {
  const field = row.original.getFieldset();
  return <NumberField name={field.price.name} />;
};

/** 消費税率選択欄 */
export const TaxRateField: CellComponent<Item> = ({ row }) => {
  const field = row.original.getFieldset();
  return <NumberSelectField name={field.taxRate.name} items={taxRateMap} />;
};

/** 追加のポイント還元率入力欄 */
export const AdditionalRateField: CellComponent<Item> = ({ row }) => {
  const field = row.original.getFieldset();
  return <NumberField name={field.additionalRate.name} />;
};

/** 行の合計還元ポイント表示 */
export const TotalRowPointDisplay: CellComponent<Item> = ({ table }) => {
  const total = useMemo(() => {
    const data = table.options.data;
    return data.reduce((acc, row) => {
      const field = row.getFieldset();
      return acc + 0;
    }, 0);
  }, [table]);
  return <Input value={total} readOnly />;
};

/** 行の合計還元倍率表示 */
export const TotalRateDisplay: CellComponent<Item> = ({ table }) => {
  const total = useMemo(() => {
    const data = table.options.data;
    return data.reduce((acc, row) => {
      const field = row.getFieldset();
      return acc + 0;
    }, 0);
  }, [table]);
  return <Input value={total} readOnly />;
};

/** 行の詳細表示ボタン */
export const DetailButton: FC<CellContext<FieldMetadata<Item>, Operation<Item>>> = () => {
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

/** 行の削除ボタン */
export const DeleteButton: CellComponent<Item> = ({ table, row }) => {
  const handleClick = useCallback(() => table.options.meta?.remove?.(row.index), [table, row]);
  return <IconButton onClick={handleClick} icon={<TrashIcon />} colorScheme="danger" />;
};
