"use client";
import * as LOCAL_STORAGE from "@/const/local-storage";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useMemo } from "react";
import * as v from "valibot";
import { SPU_DEF, SpuID } from "../const/spu";
import { spuEventCalcSchema, SPUEventOutput } from "../schema/calc";
import { initializeSPUEventForm } from "../schema/storage";
import * as logic from "./logic";

// テーブルすべてに関する状態

/**
 * 保存済みの計算結果または初期値を読み込み、計算に使用するデータとしてparseする
 */
const loadSPUEvent = () => {
  const unknownJson = (() => {
    const jsonStr =
      typeof window !== "undefined"
        ? (localStorage.getItem(LOCAL_STORAGE.CALC_RESULT) ?? "{}")
        : "{}";
    try {
      return JSON.parse(jsonStr);
    } catch {
      return {};
    }
  })();
  const result = v.safeParse(spuEventCalcSchema, unknownJson);
  if (!result.success) {
    return v.parse(spuEventCalcSchema, initializeSPUEventForm());
  }
  return result.output;
};

const calcResultAtom = atom<SPUEventOutput>(loadSPUEvent());

export const useUpdateCalcResult = () => useSetAtom(calcResultAtom);

const totalPriceAtom = atom<number>((get) => {
  const { items } = get(calcResultAtom);
  return items.reduce((acc, item) => acc + item.price, 0);
});

export const useTotalPrice = () => useAtomValue(totalPriceAtom);

// テーブルのトップレベルの状態

const taxRateAtom = atom<number>((get) => get(calcResultAtom).taxRate);

export const useTaxRate = () => useAtomValue(taxRateAtom);

const maxPointAtom = atom<number>((get) => get(calcResultAtom).maxPoint);

export const useMaxPoint = () => useAtomValue(maxPointAtom);

export const useIsSPULimitExceeded = (spuId: SpuID) => {
  const isLimitExceededAtom = useMemo(
    () =>
      atom<boolean>((get) => {
        const totalPrice = get(totalPriceAtom);
        const { max, rate, inTax } = SPU_DEF[spuId];
        return totalPrice >= Math.round((max / rate) * 100 * (inTax ? 1 : get(taxRateAtom)));
      }),
    [spuId],
  );

  return useAtomValue(isLimitExceededAtom);
};

// const rowTotalPriceAtom = (index: number) =>
//   atom<number>((get) => {
//     const { items } = get(calcResultAtom);
//     return items[index]?.price ?? 0;
//   });

// export const useRowTotalPrice = (index: number) =>
//   useAtomValue(useMemo(() => rowTotalPriceAtom(index), [index]));

const spuRateAtom = atom<number>((get) => {
  const { spu } = get(calcResultAtom);
  return logic.spuRate(spu);
});

export const useSPURate = () => useAtomValue(spuRateAtom);

const rowMagnificationAtom = (index: number) =>
  atom<number>((get) => {
    const { items, spu } = get(calcResultAtom);
    const item = items[index];
    if (!item) return 0;

    const currentShopCount = logic.currentShopCount(items);
    const { additionalRate } = item;
    const spuRate = logic.spuRate(spu);
    return spuRate + currentShopCount + additionalRate;
  });

export const useRowMagnification = (index: number) =>
  useAtomValue(useMemo(() => rowMagnificationAtom(index), [index]));

const rowTotalPointAtom = (index: number) =>
  atom<number>((get) => {
    const { items, spu } = get(calcResultAtom);
    const item = items[index];
    if (!item) return 0;

    // const shopCount = logic.currentShopCount(items);
    // const spuMagnification = logic.spuRate(spu);
    // const { additionalRate } = item;

    return 0; // TODO
  });

export const useRowTotalPoint = (index: number) =>
  useAtomValue(useMemo(() => rowTotalPointAtom(index), [index]));

const totalPointAtom = atom<number>((get) => logic.totalPoint(get(calcResultAtom)));

export const useTotalPoint = () => useAtomValue(totalPointAtom);
