import * as LOCAL_STORAGE from "@/const/local-storage";
import { useFormMetadata } from "@conform-to/react";
import { debounce } from "@material-ui/core";
import { pipe } from "@mobily/ts-belt";
import { parseWithValibot } from "conform-to-valibot";
import { RefCallback, startTransition, useCallback } from "react";
import { spuEventCalcSchema } from "../../schema/calc";
import { SPUEventInput } from "../../schema/storage";
import { useUpdateCalcResult } from "../../store";

export const useSaveFormData = () => {
  const updateCalcResult = useUpdateCalcResult();
  const form = useFormMetadata<SPUEventInput>();
  return useCallback(({ node }: { node: HTMLElement | null }) => {
    const formInstance = node?.closest("form");
    if (!formInstance) throw new Error("unreachable: should be called inside a form element");
    const result = parseWithValibot(new FormData(formInstance), { schema: spuEventCalcSchema });
    if (result.status !== "success") {
      throw new Error("invalid form value; caused by: " + JSON.stringify(result.error));
    }
    startTransition(() => updateCalcResult(result.value)); // parse後のfallback値が設定された計算結果
    debounce(
      () =>
        localStorage.setItem(
          LOCAL_STORAGE.CALC_RESULT,
          pipe(form.value, (value) => {
            if (value === undefined) return "";
            return JSON.stringify(value);
          }),
        ),
      1000, // parse前の表示用データを遅延保存
    );
  }, []);
};

/**
 * 以下の処理を行う関数をinput要素のcallback refに登録する
 * Formの値を取り出してトランジションとしてマークし、計算結果表示用の状態に保存する
 * 1秒後にデバウンス処理としてlocalStorageに保存する
 */
export const useSaveFormDataRef = () => {
  const save = useSaveFormData();
  return useCallback<RefCallback<HTMLInputElement>>((node) => {
    const callback = () => {
      save({ node });
    };

    node?.addEventListener("input", callback);
    return () => node?.removeEventListener("input", callback);
  }, []);
};
