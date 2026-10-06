import {
  type CalculationResult,
  type Order,
  type Plan,
  type Shop,
  calculateAll,
  taxExcludedTarget,
} from "@workspaces/domain";
import { Box, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { calculationAtom } from "../../state/derived";
import { addOrder, updateOrder } from "../../state/order-ops";
import { plansAtom, shopsAtom } from "../../state/queries";
import { orderPointRows, pointsText, rateText, yen } from "../plan-home/order-shared";
import type { OrderDraft } from "./order-form";

export type OrderPreview = {
  /** The plan's shop count with the draft, when the draft makes it grow. */
  newShopCount: number | undefined;
  /** The draft's target amount before tax. */
  base: number;
  /** The sum of the rates the draft gets ("+N倍" is N% of `base`). */
  rate: number;
  points: number;
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
  shops: Shop[];
  before: Map<string, CalculationResult>;
  planId: string;
  draft: OrderDraft;
  original: Order | undefined;
}): OrderPreview {
  const { plans, before, planId, draft, original } = input;
  const shops = draft.shop
    ? [...input.shops.filter((shop) => shop.id !== draft.shop?.id), draft.shop]
    : input.shops;
  const withDraft = plans.map((plan) =>
    plan.id !== planId
      ? plan
      : original
        ? updateOrder(plan, draft.order)
        : addOrder(plan, draft.order),
  );
  const after = calculateAll(withDraft, shops);
  const planBefore = before.get(planId);
  const planAfter = after.get(planId);
  const rows = pointsOf(planAfter, draft.order);
  const points = rows.reduce((sum, row) => sum + row.points, 0);
  const originalPoints = pointsOf(planBefore, original).reduce((sum, row) => sum + row.points, 0);
  const shopCountBefore = planBefore?.shopCount ?? 0;
  const shopCountAfter = planAfter?.shopCount ?? 0;
  const benefits = withDraft.find((plan) => plan.id === planId)?.benefits ?? [];
  return {
    newShopCount: shopCountAfter > shopCountBefore ? shopCountAfter : undefined,
    base: draft.order.lineItems.reduce((sum, item) => sum + taxExcludedTarget(item), 0),
    rate: orderPointRows(rows, benefits, shopCountAfter, draft.order.lineItems).rate,
    points,
    held: draft.order.onHold,
    shopAroundRateGain:
      (planAfter?.shopAroundOutlook?.currentRate ?? 0) -
      (planBefore?.shopAroundOutlook?.currentRate ?? 0),
    othersGain: sumOfTotals(after) - points - (sumOfTotals(before) - originalPoints),
  };
}

const percent = (rate: number) => `${Number(rate.toFixed(2)).toLocaleString("ja-JP")}%`;
const signed = (points: number) => `${points < 0 ? "−" : "+"}${pointsText(Math.abs(points))}`;

/** 「この注文で（5店舗目としてカウント）税抜 ¥X × R% → YP」 under the editor's fields. */
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
  const preview = useMemo(
    () => (draft ? previewOf({ plans, shops, before, planId, draft, original }) : undefined),
    [plans, shops, before, planId, draft, original],
  );

  return (
    <Box
      aria-live="polite"
      data-preview
      rounded="xl"
      bg="primary.subtle"
      p="3"
      display="flex"
      flexDirection="column"
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
          <Text fontSize="xs">
            この注文で
            {preview.newShopCount ? (
              <>
                （<b>{preview.newShopCount}店舗目</b>としてカウント）
              </>
            ) : null}
          </Text>
          <Text fontSize="md">
            税抜 {yen(preview.base)} × {percent(preview.rate)} →{" "}
            <Text as="b" fontSize="xl" color="primary.fg">
              {pointsText(preview.points)}
            </Text>
          </Text>
          {preview.newShopCount && preview.shopAroundRateGain > 0 ? (
            <Text fontSize="xs">
              買い回りが <b>{rateText(preview.shopAroundRateGain)}</b> になり、ほかの注文も{" "}
              <b>{signed(preview.othersGain)}</b>
            </Text>
          ) : null}
        </>
      )}
    </Box>
  );
}
