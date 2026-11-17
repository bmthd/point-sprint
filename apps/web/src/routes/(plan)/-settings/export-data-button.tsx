import { Button, Text, VStack } from "@workspaces/ui";
import { atom, useAtomValue } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { calculatedPlansAtom, calculationAtom } from "#/state/derived.ts";
import {
  plansAtom,
  plansQueryAtom,
  profileAtom,
  profileQueryAtom,
  shopsAtom,
  shopsQueryAtom,
  spuMonthsAtom,
  spuMonthsQueryAtom,
} from "#/state/queries.ts";
import { exportData, exportFileName } from "./export-data.ts";

function downloadJson(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** Saves a file on the user's device; tests replace it in their Jotai store. */
export const saveFileAtom = atom<{ save: (name: string, text: string) => void }>({
  save: downloadJson,
});

/** 「データを書き出す」: saves every stored row and the points calculated as one JSON file. */
export function ExportDataButton() {
  // Before the stored rows are read, the plans and shops are empty and so would the file be.
  const loaded = [
    useAtomValue(plansQueryAtom),
    useAtomValue(shopsQueryAtom),
    useAtomValue(profileQueryAtom),
    useAtomValue(spuMonthsQueryAtom),
  ].every((query) => query.isSuccess);
  const { save } = useAtomValue(saveFileAtom);
  const exportAll = useAtomCallback(
    useCallback(
      (get) => {
        const exportedAt = new Date();
        const data = exportData({
          plans: get(plansAtom),
          shops: get(shopsAtom),
          profile: get(profileAtom),
          spuMonths: get(spuMonthsAtom),
          calculatedPlans: get(calculatedPlansAtom),
          results: get(calculationAtom),
          exportedAt,
        });
        save(exportFileName(exportedAt), JSON.stringify(data, null, 2));
      },
      [save],
    ),
  );

  return (
    <VStack gap="2" alignItems="stretch">
      <Button variant="outline" disabled={!loaded} onClick={exportAll}>
        データを書き出す
      </Button>
      <Text fontSize="sm" color="fg.muted">
        プラン・ショップ台帳・SPU と、計算したポイントを JSON ファイルに保存します。使っている AI
        に渡して相談できます。
      </Text>
    </VStack>
  );
}
