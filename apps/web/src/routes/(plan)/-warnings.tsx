import type { CalculationWarning, Plan } from "@workspaces/domain";
import { Alert, Button, VStack } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { storageHealthQueryAtom } from "../../state/queries";

/** `2026-10-11` → `10/11`. */
const monthDay = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

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

function messagesOf(
  plan: Plan,
  warnings: CalculationWarning[],
  hasShopAround: boolean,
  storage: { quarantined: number; wasReset: boolean } | undefined,
): string[] {
  const messages: string[] = [];
  const ordersOf = (type: CalculationWarning["type"]) =>
    warnings.flatMap((warning) =>
      warning.type === type && "orderId" in warning
        ? plan.orders.filter((order) => order.id === warning.orderId)
        : [],
    );

  const outside = ordersOf("order-outside-period");
  if (outside.length > 0) {
    const dates = [...new Set(outside.map((order) => monthDay(order.date)))].join("、");
    messages.push(
      `期間外の注文が${outside.length}件あります（${dates}）。${hasShopAround ? "マラソンの対象外です。" : ""}`,
    );
  }
  const unknown = ordersOf("unknown-shop");
  if (unknown.length > 0) {
    messages.push(
      `台帳にないショップの注文が${unknown.length}件あります。通常ポイントは計算していますが、購入先で決まる特典と買い回りの対象にはなりません。`,
    );
  }
  if (warnings.some((warning) => warning.type === "shared-cap-mismatch")) {
    messages.push(
      "上限を共有している特典で、上限の値が食い違っています。小さいほうの上限で計算しています。",
    );
  }
  messages.push(...storageMessages(storage));
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
      <Button variant="outline" bg="bg.panel" size="lg" onClick={() => void refetch()}>
        再試行
      </Button>
    </Alert.Root>
  );
}

/** Warnings about the plan's orders and about stored data that could not be read. */
export function Warnings({
  plan,
  warnings,
  hasShopAround,
}: {
  plan: Plan;
  warnings: CalculationWarning[];
  hasShopAround: boolean;
}) {
  const { data: storage } = useAtomValue(storageHealthQueryAtom);
  const messages = messagesOf(plan, warnings, hasShopAround, storage);
  return (
    <VStack gap="2" alignItems="stretch" _empty={{ display: "none" }}>
      <StorageHealthFailure />
      {messages.map((message) => (
        <Alert.Root key={message} status="warning" role="status" alignItems="center">
          <Alert.Icon />
          <Alert.Description>{message}</Alert.Description>
        </Alert.Root>
      ))}
    </VStack>
  );
}
