import { ConfirmDialog } from "@/ui/dialog";
import { InfoButton } from "@/ui/icon-button/info-button";
import { SPU_DEF, SpuID } from "@/views/top-page/const/spu";
import { useTaxRate } from "@/views/top-page/store";
import { DataList, DataListItemProps, DialogBody, DialogHeader, Image } from "@yamada-ui/react";
import { ComponentRef, FC, useCallback, useRef } from "react";

const priceFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
});

export const SPUInformationButton: FC<{ spuId: SpuID }> = ({ spuId }) => {
  const spu = SPU_DEF[spuId];
  const tax = useTaxRate();
  const dialogRef = useRef<ComponentRef<typeof ConfirmDialog>>(null);
  const handleClick = useCallback(() => dialogRef.current?.confirm(), [dialogRef]);
  const items: DataListItemProps[] = [
    {
      term: "還元率",
      description: `+${spu.rate}倍`,
    },
    {
      term: "税計算",
      description: spu.inTax ? "税込" : "税抜",
    },
    {
      term: "購入上限金額",
      description:
        spu.max === Number.POSITIVE_INFINITY
          ? "上限なし"
          : `${priceFormatter.format(Math.round((spu.max / spu.rate) * 100 * (spu.inTax ? 1 : tax)))}円`,
    },
    {
      term: "最大獲得ポイント",
      description:
        spu.max === Number.POSITIVE_INFINITY ? "上限なし" : `${priceFormatter.format(spu.max)}円`,
    },
  ];
  return (
    <>
      <InfoButton onClick={handleClick} />
      <ConfirmDialog ref={dialogRef}>
        <DialogHeader>{spu.name}</DialogHeader>
        <DialogBody>
          <Image src={spu.image} alt={spu.name} />
          <DataList items={items} />
        </DialogBody>
      </ConfirmDialog>
    </>
  );
};
