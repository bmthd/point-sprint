"use client";
import { ConfirmDialog } from "@/ui/dialog";
import { CheckboxField, NumberField, SelectField, TextField,CustomSwitchField } from "@/ui/form";
import { Operation } from "@/ui/table";
import { FieldMetadata, FormMetadata } from "@conform-to/react";
import {
  GripVerticalIcon,
  ListPlusIcon,
  RotateCcwIcon,
  StoreIcon,
  TrashIcon,
} from "@yamada-ui/lucide";
import { Button, IconButton, Input, Label, Text } from "@yamada-ui/react";
import { CellContext, Column, HeaderContext, Table, TableMeta } from "@yamada-ui/table";
import { ComponentRef, FC, useCallback, useMemo, useRef } from "react";
import { taxRateMap } from "../../../const";
import { initializeItem, Item, SPUEvent } from "../../../schema";
import { DetailButton } from "./detail-button";

/* Row Components */

type CellComponent<T> = FC<CellContext<FieldMetadata<T>, Operation<T>>>;

const DragHandle: FC = () => <IconButton icon={<GripVerticalIcon />} colorScheme="gray" p={0} />;

const ShopCountButton: CellComponent<Item> = ({ row }) => {
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

const NameField: CellComponent<Item> = ({ row }) => {
  const field = row.original.getFieldset();
  return <TextField name={field.name.name} />;
};

const PriceField: CellComponent<Item> = ({ row }) => {
  const field = row.original.getFieldset();
  return <NumberField name={field.price.name} />;
};

const TaxRateField: CellComponent<Item> = ({ row }) => {
  const field = row.original.getFieldset();
  return <SelectField name={field.taxRate.name} options={taxRateMap} />;
};

const AdditionalRateField: CellComponent<Item> = ({ row }) => {
  const field = row.original.getFieldset();
  return <NumberField name={field.additionalRate.name} />;
};

const TotalRowPointDisplay: CellComponent<Item> = ({ table }) => {
  const total = useMemo(() => {
    const data = table.options.data;
    return data.reduce((acc, row) => {
      const field = row.getFieldset();
      return acc + 0;
    }, 0);
  }, [table]);
  return <Input value={total} readOnly />;
};

const TotalRateDisplay: CellComponent<Item> = ({ table }) => {
  const total = useMemo(() => {
    const data = table.options.data;
    return data.reduce((acc, row) => {
      const field = row.getFieldset();
      return acc + 0;
    }, 0);
  }, [table]);
  return <Input value={total} readOnly />;
};

const DeleteButton: CellComponent<Item> = ({ table, row }) => {
  const handleClick = useCallback(() => table.options.meta?.remove?.(row.index), [table, row]);
  return <IconButton onClick={handleClick} icon={<TrashIcon />} colorScheme="danger" />;
};

/* Footer Components */
type HeaderComponent<T> = FC<HeaderContext<FieldMetadata<T>, Operation<T>>>;

const AddRowButton: HeaderComponent<Item> = ({ table }) => {
  const handleClick = useCallback(() => table.options.meta?.add?.(initializeItem()), [table]);
  return (
    <Button onClick={handleClick} startIcon={<ListPlusIcon fontSize="2xl" />} w="full">
      行追加
    </Button>
  );
};

const TotalPointDisplay: HeaderComponent<Item> = ({ table }) => {
  const total = useMemo(() => {
    const data = table.options.data;
    return data.reduce((acc, row) => {
      const field = row.getFieldset();
      return acc + 0;
    }, 0);
  }, [table]);
  return <Input value={total} readOnly />;
};

const AddAdditionalRateButton: HeaderComponent<Item> = ({ table }) => {
  const handleClick = useCallback(() => table.options.meta?.add?.(), [table]);
  return <Button onClick={handleClick}>追加</Button>;
};

const ResetButton: HeaderComponent<Item> = ({ table }) => {
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

/** Form操作用関数をまとめたオブジェクトへの安定した参照を提供する */
const useOperations = ({
  form,
  field,
}: { form: FormMetadata<SPUEvent>; field: FieldMetadata<Item[]> }): TableMeta<
  FieldMetadata<Item>
> => {
  const add = useCallback(
    (item?: Partial<Item>) => form.insert({ name: field.name, defaultValue: item }),
    [form, field],
  );
  const remove = useCallback(
    (index: number) => form.remove({ index, name: field.name }),
    [form, field],
  );
  const save = useCallback(() => {}, []);
  const move = useCallback((from: number, to: number) => {}, []);
  return useMemo(() => ({ add, remove, save, move }), [add, remove, save, move]);
};

export const CalcTable: FC<{ form: FormMetadata<SPUEvent>; field: FieldMetadata<Item[]> }> = ({
  form,
  field,
}) => {
  const data = useMemo(() => field.getFieldList(), [field]);

  const columns = useMemo<Column<FieldMetadata<Item>, Operation<Item>>[]>(
    () => [
      {
        id: "active",

        columns: [
          { header: "並び替え", cell: DragHandle },
          { header: "購入カウント", cell: ShopCountButton },
        ],
        footer: AddRowButton,
      },
      {
        id: "input-group",
        columns: [
          { header: "商品名", cell: NameField },
          { header: "価格", cell: PriceField },
          { header: "税率", cell: TaxRateField },
        ],
        footer: TotalPointDisplay,
      },
      {
        header: "追加還元",
        cell: AdditionalRateField,
        footer: AddAdditionalRateButton,
      },
      // {
      //   header: "キャンペーン",
      //   // cell: ({ row }) => <Box>{Object.keys(row.original.getFieldset().campaigns).join(",")}</Box>,
      // },
      { header: "合計ポイント", cell: TotalRowPointDisplay },
      { header: "合計倍率", cell: TotalRateDisplay },
      {
        id: "button-group",
        columns: [
          { header: "詳細", cell: DetailButton },
          { header: "削除", cell: DeleteButton },
        ],
        footer: ResetButton,
      },
    ],
    [],
  );

  const meta = useOperations({ form, field });

  return (
    <Table
      {...{ data, columns, meta }}
      withFooter
      enableRowSelection={false}
      headerProps={{ bg: "brand", textColor: "white" }}
      bg="white"
    />
  );
};
