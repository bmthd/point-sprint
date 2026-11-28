import {
  type CalculationWarning,
  channels,
  disabledAchievedSpu,
  eventPlanPeriod,
  type OfficialEvent,
  type Plan,
  presaleOf,
  spuPurchaseRules,
  standardSpu,
  withEffectiveAccount,
} from "@workspaces/domain";
import { Alert, Button, VStack } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { grouped } from "#/ui/format.ts";
import { QuarantineNotice } from "./-quarantine-notice.tsx";
import { officialEventsAtom } from "#/routes/-official-events.ts";

import { planAtom, planResultAtom, accountSettingsAtom } from "#/state/derived.ts";
import { shopsAtom, spuMonthsAtom, storageHealthQueryAtom } from "#/state/query-atoms.ts";

/** `2026-10-11` → `10/11`. */
export function monthDay(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

/** `2026-10` → `10月`. */
export function monthText(month: string) {
  return `${Number(month.slice(5, 7))}月`;
}

/**
 * The SPU that the plan's orders achieve but the user turned off for the month: 「楽天ブックスで
 * 3,000円以上の注文がありますが、10月の SPU の楽天ブックスが OFF です。」 Only those of `month`
 * when it is given.
 */
export function useSpuOffMessages(plan: Plan | undefined, month?: string): string[] {
  const shops = useAtomValue(shopsAtom);
  const months = useAtomValue(spuMonthsAtom);
  const settings = useAtomValue(accountSettingsAtom);
  if (!plan) return [];
  const achievements = disabledAchievedSpu(withEffectiveAccount(plan, settings), shops, months);
  return achievements.flatMap(({ month: achieved, benefitId }) => {
    if (month !== undefined && achieved !== month) return [];
    const rule = spuPurchaseRules.find((candidate) => candidate.benefitId === benefitId);
    const benefit = standardSpu.find((candidate) => candidate.id === benefitId);
    if (!rule || !benefit) return [];
    const amount = grouped(rule.minOrderAmount);
    return [
      `${channels[rule.channel].label}で ${amount}円以上の注文がありますが、${monthText(achieved)}の SPU の${benefit.label}が OFF です。`,
    ];
  });
}

/** What went wrong while opening the stored data, if anything. Rows set aside have their own notice. */
export function storageMessages(storage: { wasReset: boolean } | undefined): string[] {
  const messages: string[] = [];
  if (storage?.wasReset) {
    messages.push("保存されたデータを開けなかったため、空の状態からやり直しています。");
  }
  return messages;
}

/**
 * About the orders on the first and last days of the plan's event, which may start or end partway
 * through the day: 「期間の初日・最終日の注文が2件あります（10/4、10/9）。10/4 20:00 より前、10/9
 * 01:59 より後の注文は対象外ですが、ここでは対象に数えています。」 The first day is the 先行セール's
 * for a buyer who can shop in it.
 */
function edgeMessage(
  plan: Plan,
  event: OfficialEvent | undefined,
  warnings: CalculationWarning[],
): string | undefined {
  const period = event ? eventPlanPeriod(event) : undefined;
  const samePeriod = period?.start === plan.period.start && period.end === plan.period.end;
  const presale = event ? presaleOf(event.benefits) : undefined;
  const edges = warnings.flatMap((warning) => {
    if (warning.type !== "order-on-period-edge") return [];
    const date = plan.orders.find((order) => order.id === warning.orderId)?.date;
    if (date === undefined) return [];
    const time = !samePeriod
      ? undefined
      : warning.edge === "end"
        ? event?.times?.end
        : date === presale?.start
          ? presale.times?.start
          : event?.times?.start;
    return time === ALL_DAY[warning.edge] ? [] : [{ edge: warning.edge, date, time }];
  });
  if (edges.length === 0) return undefined;
  const days = [...new Map(edges.map((one) => [`${one.edge}:${one.date}`, one])).values()].sort(
    (a, b) => (a.date < b.date ? -1 : 1),
  );
  const dates = days.map((one) => monthDay(one.date)).join("、");
  const outside = days.every((one) => one.time !== undefined)
    ? `${days
        .map((one) =>
          one.edge === "start"
            ? `${monthDay(one.date)} ${one.time} より前`
            : `${monthDay(one.date)} ${one.time} より後`,
        )
        .join("、")}の注文は対象外です`
    : "時刻によっては対象外です";
  return `期間の初日・最終日の注文が${edges.length}件あります（${dates}）。${outside}が、ここでは対象に数えています。`;
}

const ALL_DAY = { start: "00:00", end: "23:59" } as const;

/**
 * About the orders on the days of the plan's 先行セール that its buyer cannot shop in:
 * 「12/3 の注文が1件あります。先行セールの日の注文は、楽天モバイルを使っている人だけ買いまわりの
 * 対象です。12月の SPU の楽天モバイルが OFF なので、対象外にしています。」
 */
function closedPresaleMessage(
  plan: Plan,
  event: OfficialEvent | undefined,
  warnings: CalculationWarning[],
): string | undefined {
  const orders = warnings.flatMap((warning) =>
    warning.type === "order-in-closed-presale"
      ? plan.orders.filter((order) => order.id === warning.orderId)
      : [],
  );
  const presale = event ? presaleOf(event.benefits) : presaleOf(plan.benefits);
  if (orders.length === 0 || !presale) return undefined;
  const dates = [...new Set(orders.map((order) => monthDay(order.date)))].join("、");
  const spu = standardSpu.find((benefit) => benefit.id === presale.spuBenefitId)?.label ?? "SPU";
  return `${dates} の注文が${orders.length}件あります。先行セールの日の注文は、${spu}を使っている人だけ買いまわりの対象です。${monthText(presale.start.slice(0, 7))}の SPU の${spu}が OFF なので、対象外にしています。`;
}

function messagesOf(
  plan: Plan,
  event: OfficialEvent | undefined,
  warnings: CalculationWarning[],
  hasShopAround: boolean,
  storage: { wasReset: boolean } | undefined,
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
  const edge = edgeMessage(plan, event, warnings);
  if (edge) messages.push(edge);
  const closedPresale = closedPresaleMessage(plan, event, warnings);
  if (closedPresale) messages.push(closedPresale);
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
export function Warnings({ planId }: { planId: string }) {
  const plan = useAtomValue(planAtom(planId));
  const result = useAtomValue(planResultAtom(planId));
  const offMessages = useSpuOffMessages(plan);
  const { data: storage } = useAtomValue(storageHealthQueryAtom);
  const event = useAtomValue(officialEventsAtom).find(
    (candidate) => candidate.id === plan?.officialEventId,
  );
  if (!plan || !result) return null;
  const messages = [
    ...messagesOf(plan, event, result.warnings, result.shopAroundOutlook !== null, storage),
    ...offMessages,
  ];
  return (
    <VStack gap="2" alignItems="stretch" _empty={{ display: "none" }}>
      <StorageHealthFailure />
      <QuarantineNotice />
      {messages.map((message) => (
        <Alert.Root key={message} status="warning" role="status" alignItems="center">
          <Alert.Icon />
          <Alert.Description>{message}</Alert.Description>
        </Alert.Root>
      ))}
    </VStack>
  );
}
