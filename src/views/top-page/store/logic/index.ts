import { A, D, pipe } from "@mobily/ts-belt";
import { SPU_DEF } from "../../const/spu";
import { CalcItem, SPUEventOutput } from "../../schema/calc";

export const currentShopCount = (items: CalcItem[]): number => {
  return pipe(
    items,
    A.filter((item) => item.price !== undefined && item.active && !item.sameStore),
    A.length,
    (c) => c + 1,
  );
};

export const spuRate = (spu: SPUEventOutput["spu"]): number =>
  pipe(
    spu,
    D.mapWithKey((k) => SPU_DEF[k].rate ?? 0),
    D.values,
    A.reduce(1, (acc, rate) => acc + rate),
  );
