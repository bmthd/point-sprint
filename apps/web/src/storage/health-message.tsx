import { Alert, Button } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { storageHealthQueryAtom } from "../state/queries";

/** What went wrong while reading the stored data, if anything. */
export function storageMessages(
  storage: { quarantined: number; wasReset: boolean } | undefined,
): string[] {
  const messages: string[] = [];
  if (storage?.wasReset) {
    messages.push("保存されたデータを開けなかったため、空の状態からやり直しています。");
  }
  if (storage && storage.quarantined > 0) {
    messages.push(
      `読み込めなかったデータが${storage.quarantined}件あります。表示と計算には含めていません。`,
    );
  }
  return messages;
}

/** Shown when the stored data could not be checked, with a way to check again. */
export function StorageHealthFailure() {
  const { isError, refetch } = useAtomValue(storageHealthQueryAtom);
  if (!isError) return null;
  return (
    <Alert.Root status="error" role="alert" alignItems="center">
      <Alert.Icon />
      <Alert.Description flex="1">保存データの状態を確認できませんでした。</Alert.Description>
      <Button variant="outline" size="lg" onClick={() => void refetch()}>
        再試行
      </Button>
    </Alert.Root>
  );
}
