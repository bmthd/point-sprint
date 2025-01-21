"use client";
import * as LOCAL_STORAGE from "@/const/local-storage";
import { atom, useAtomValue, useSetAtom } from "jotai";
import * as v from "valibot";
import { initializeSPUEventForm, SPUEventOutput, spuEventSchema } from "../schema";

/**
 * 保存済みの計算結果または初期値を読み込み、計算に使用するデータとしてparseする
 */
const loadSPUEvent = () => {
  const unknownJson = (() => {
    const jsonStr = localStorage.getItem(LOCAL_STORAGE.CALC_RESULT) ?? "{}";
    try {
      return JSON.parse(jsonStr);
    } catch {
      return {};
    }
  })();
  const result = v.safeParse(spuEventSchema, unknownJson);
  if (!result.success) {
    return v.parse(spuEventSchema, initializeSPUEventForm());
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

// const rowTotalPriceAtom = (index: number) =>
//   atom<number>((get) => {
//     const { items } = get(calcResultAtom);
//     return items[index]?.price ?? 0;
//   });

// export const useRowTotalPrice = (index: number) =>
//   useAtomValue(useMemo(() => rowTotalPriceAtom(index), [index]));
