import { Button, Text, VStack } from "@workspaces/ui";
import { atom, useAtomValue, useSetAtom } from "jotai";
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

/** Whether the stored rows are read: before that the plans and shops are empty, and so would the file be. */
const exportReadyAtom = atom((get) =>
  [get(plansQueryAtom), get(shopsQueryAtom), get(profileQueryAtom), get(spuMonthsQueryAtom)].every(
    (query) => query.isSuccess,
  ),
);

/** Saves every stored row and the points calculated as one JSON file. */
const exportDataAtom = atom(null, (get) => {
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
  downloadJson(exportFileName(exportedAt), JSON.stringify(data, null, 2));
});

/** 「データを書き出す」: saves every stored row and the points calculated as one JSON file. */
export function ExportDataButton() {
  const ready = useAtomValue(exportReadyAtom);
  const exportAll = useSetAtom(exportDataAtom);

  return (
    <VStack gap="2" alignItems="stretch">
      <Button variant="outline" disabled={!ready} onClick={() => exportAll()}>
        データを書き出す
      </Button>
      <Text fontSize="sm" color="fg.muted">
        プラン・ショップ台帳・SPU と、計算したポイントを JSON ファイルに保存します。使っている AI
        に渡して相談できます。
      </Text>
    </VStack>
  );
}
