"use client";
import { PlusIcon, StoreIcon } from "@yamada-ui/lucide";
import { Box, Button, IconButton, Input, NumberInput } from "@yamada-ui/react";
import { Column, Table } from "@yamada-ui/table";
import { FC } from "react";
import { Item } from "../../../schema";

export const CalcTable: FC = () => {
  const data: Item[] = [
    {
      name: "test",
      price: 100,
      active: true,
      additionalRate: 0,
      taxRate: 0,
      campaigns: {},
      sameStore: false,
    },
  ];
  const columns: Column<Item>[] = [
    {
      id: "active",
      columns: [
        { header: "並び替え", cell: ({ row }) => <Box>{row.index}</Box> },
        {
          header: "購入カウント",
          cell: ({ row }) => (
            <Box>
              <StoreIcon />
              {row.original.active ? "○" : "×"}
            </Box>
          ),
        },
      ],
      footer: () => <Button>追加</Button>,
    },
    {
      id: "input-group",
      columns: [
        { header: "商品名", cell: ({ row }) => <Input defaultValue={row.original.name} /> },
        { header: "価格", cell: ({ row }) => <Input defaultValue={row.original.price} /> },
        { header: "税率", cell: ({ row }) => <Input defaultValue={row.original.taxRate} /> },
      ],
      footer: () => <Input readOnly>合計</Input>,
    },
    {
      header: "追加還元",
      cell: ({ row }) => <NumberInput defaultValue={row.original.additionalRate} />,
      footer: () => <IconButton icon={<PlusIcon />} />,
    },
    {
      header: "キャンペーン",
      // cell: ({ row }) => <Box>{Object.keys(row.original.campaigns).join(",")}</Box>,
    },
    { header: "合計倍率", cell: () => <Input readOnly /> },
    { header: "同一店舗", cell: ({ row }) => <Box>{row.original.sameStore ? "○" : "×"}</Box> },
    { header: "詳細", cell: () => <Button>詳細</Button> },
    { header: "削除", cell: () => <Button colorScheme="danger">削除</Button> },
  ];
  return <Table {...{ data, columns }}  enableRowSelection={false} headerProps={{bg:"brand", textColor:"white"}} />;
};
