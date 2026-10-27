import {
  type CalculationResult,
  type Order,
  type Plan,
  type Shop,
  calculateAll,
  capLines,
  taxExcludedTarget,
} from "@workspaces/domain";
import { Flex, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { asCalculatedAtom, calculationAtom } from "../../../state/derived";
import { addOrder, updateOrder } from "../../../state/order-ops";
import { plansAtom, shopsAtom } from "../../../state/queries";
import { orderPointRows, pointsText, rateText, yen } from "../-order-shared";
import type { OrderDraft } from "../-order-form";

export type OrderPreview = {
  /** The plan's shop count with the draft, when the draft makes it grow. */
  newShopCount: number | undefined;
  /** The draft's target amount before tax. */
  base: number;
  /** The sum of the rates the draft gets ("+N倍" is N% of `base`). */
  rate: number;
  points: number;
  rawPoints: number;
  reachedShopAroundCap: number | undefined;
  held: boolean;
  /** How much the shop-around rate grows. */
  shopAroundRateGain: number;
  /** How many points every other order (in every plan) gains or loses. */
  othersGain: number;
};

const sumOfTotals = (results: Map<string, CalculationResult>) =>
  [...results.values()].reduce((sum, result) => sum + result.total, 0);

const pointsOf = (result: CalculationResult | undefined, order: Order | undefined) => {
  const ids = new Set(order?.lineItems.map((item) => item.id));
  return (result?.breakdown ?? []).filter((row) => ids.has(row.lineItemId));
};

/**
 * What saving the draft would change: every plan is calculated again with the draft added (or in
 * place of the order it edits) and compared with the figures as they are.
 */
export function previewOf(input: {
  plans: Plan[];
  /** Turns plans into the plans as they are calculated (`asCalculatedAtom`). */
  asCalculated: (plans: Plan[]) => Plan[];
  shops: Shop[];
  before: Map<string, CalculationResult>;
  planId: string;
  draft: OrderDraft;
  original: Order | undefined;
}): OrderPreview {
  const { plans, asCalculated, before, planId, draft, original } = input;
  const shops = draft.shop
    ? [...input.shops.filter((shop) => shop.id !== draft.shop?.id), draft.shop]
    : input.shops;
  const withDraft = asCalculated(
    plans.map((plan) =>
      plan.id !== planId
        ? plan
        : original
          ? updateOrder(plan, draft.order)
          : addOrder(plan, draft.order),
    ),
  );
  const after = calculateAll(withDraft, shops);
  const planBefore = before.get(planId);
  const planAfter = after.get(planId);
  const rows = pointsOf(planAfter, draft.order);
  const points = rows.reduce((sum, row) => sum + row.points, 0);
  const originalPoints = pointsOf(planBefore, original).reduce((sum, row) => sum + row.points, 0);
  const shopCountBefore = planBefore?.shopCount ?? 0;
  const shopCountAfter = planAfter?.shopCount ?? 0;
  const plan = withDraft.find((plan) => plan.id === planId);
  const benefits = plan?.benefits ?? [];
  const reachedShopAroundCap =
    plan && planAfter
      ? capLines(plan, planAfter).find(
          (line) =>
            line.benefit.id === planAfter.shopAroundOutlook?.benefitId && line.remaining === 0,
        )?.cap
      : undefined;
  return {
    newShopCount: shopCountAfter > shopCountBefore ? shopCountAfter : undefined,
    base: draft.order.lineItems.reduce((sum, item) => sum + taxExcludedTarget(item), 0),
    rate: orderPointRows(rows, benefits, planAfter?.rates ?? {}, draft.order.lineItems).rate,
    points,
    rawPoints: rows.reduce((sum, row) => sum + (row.rawPoints ?? row.points), 0),
    reachedShopAroundCap,
    held: draft.order.onHold,
    shopAroundRateGain:
      (planAfter?.shopAroundOutlook?.currentRate ?? 0) -
      (planBefore?.shopAroundOutlook?.currentRate ?? 0),
    othersGain: sumOfTotals(after) - points - (sumOfTotals(before) - originalPoints),
  };
}

const percent = (rate: number) => `${Number(rate.toFixed(2)).toLocaleString("ja-JP")}%`;
const signed = (points: number) => `${points < 0 ? "−" : "+"}${pointsText(Math.abs(points))}`;

/** The total change and its allocation to this order and every other order. */
export function OrderPreviewBox({
  planId,
  draft,
  original,
}: {
  planId: string;
  draft: OrderDraft | undefined;
  original: Order | undefined;
}) {
  const plans = useAtomValue(plansAtom);
  const shops = useAtomValue(shopsAtom);
  const before = useAtomValue(calculationAtom);
  const asCalculated = useAtomValue(asCalculatedAtom);
  const preview = useMemo(
    () =>
      draft
        ? previewOf({
            plans,
            asCalculated,
            shops,
            before,
            planId,
            draft,
            original,
          })
        : undefined,
    [plans, shops, before, asCalculated, planId, draft, original],
  );

  return (
    <Flex
      role="status"
      aria-label="ポイントの目安"
      rounded="md"
      bg="primary.subtle"
      p="3"
      direction="column"
      gap="1"
      fontVariantNumeric="tabular-nums"
    >
      {!preview ? (
        <Text fontSize="xs" color="fg.muted">
          ショップと金額を入れると、もらえるポイントの目安が出ます
        </Text>
      ) : preview.held ? (
        <Text fontSize="xs">保留中の注文は計算に入りません</Text>
      ) : (
        <>
          {preview.newShopCount ? (
            <Text fontSize="xs">
              <b>{preview.newShopCount}店舗目</b>としてカウント
            </Text>
          ) : null}
          <Text fontSize="xl" color="primary.fg" as="b">
            この注文で {signed(preview.points + preview.othersGain)}
          </Text>
          <Text fontSize="xs">
            この注文単体で {pointsText(preview.points)}（税抜 {yen(preview.base)} ×{" "}
            {percent(preview.rate)}
            {preview.rawPoints > preview.points
              ? ` = ${pointsText(preview.rawPoints)}、上限で ${pointsText(preview.rawPoints - preview.points)} 減`
              : ""}
            ）
          </Text>
          {preview.othersGain !== 0 || preview.newShopCount ? (
            <Text fontSize="xs">
              ほかの注文 {signed(preview.othersGain)}
              {preview.shopAroundRateGain > 0 && preview.reachedShopAroundCap === undefined
                ? `（買い回りが ${rateText(preview.shopAroundRateGain)}）`
                : ""}
            </Text>
          ) : null}
          {preview.shopAroundRateGain > 0 && preview.reachedShopAroundCap !== undefined ? (
            <Text fontSize="xs">
              買い回りは {rateText(preview.shopAroundRateGain)} になりますが、上限{" "}
              {pointsText(preview.reachedShopAroundCap)} に届いているため、
              {preview.othersGain < 0
                ? `ほかの注文の分の ${pointsText(-preview.othersGain)} がこの注文に移ります`
                : "ポイントは増えません"}
            </Text>
          ) : null}
        </>
      )}
    </Flex>
  );
}
