import {
  type Benefit,
  type BreakdownRow,
  type LineItem,
  type Order,
  POINT_GROUPS,
  type Plan,
  type PointGroup,
  pointGroupOf,
  deepEqual,
} from "@workspaces/domain";
import { Badge, Button, Heading, Modal, Tag, Text, dataAttr, useDisclosure } from "@workspaces/ui";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { atomFamily } from "jotai-family";
import { selectAtom } from "jotai/utils";
import { type ReactNode, type RefObject, useCallback, useRef, useState } from "react";
import { orderAtom, orderPointsAtom, calculatedPlanAtom, planResultAtom } from "#/state/derived.ts";
import { clearOrdersAtom, removeOrderAtom, saveOrderDraftAtom } from "#/state/plan-operations.ts";
import { shopsAtom } from "#/state/query-atoms.ts";
import { openOrderIdAtom } from "./-ui.ts";
import type { OrderDraft } from "./-order-form.ts";

// What the phone's order cards and the desktop's order list have in common.

/** Rakuten's service and campaign images are served from R2, not kept in the repository. */
const IMAGE_ORIGIN = "https://assets.bmth.dev/point-sprint";

/** A benefit's `imagePath` (`/img/...`) → the URL its image is served from. */
export function imageUrl(imagePath: string) {
  return `${IMAGE_ORIGIN}${imagePath}`;
}

type OrderKey = { planId: string; orderId: string };
const sameOrderKey = (a: OrderKey, b: OrderKey) => a.planId === b.planId && a.orderId === b.orderId;

/** One line of an order's breakdown: a point group, or one campaign on its own. */
export type OrderPointRow = {
  key: string;
  group: PointGroup;
  label: string;
  /** The sum of the rates ("+N倍") of the benefits behind the row. */
  rate: number;
  points: number;
};

/**
 * An order's points. A held order gets the ones it would have once counted, so turning 購入決定
 * on and off changes how they are drawn, not what they are.
 */
export type OrderCardPoints = {
  rows: OrderPointRow[];
  total: number;
  /** The sum of the rows' rates. */
  rate: number;
  /** Labels of the campaigns that gave the order points. */
  campaigns: string[];
  /** Each item's points by its id, what is left of them under the caps. */
  itemPoints: Record<string, number>;
};

const groupLabels: Record<Exclude<PointGroup, "campaign">, string> = {
  base: "通常",
  spu: "SPU",
  marathon: "マラソン",
};

/**
 * Groups an order's breakdown rows into the lines shown on its card. A row's rate is the sum of the
 * nominal rates of the benefits behind it, as the calculation gave them (`rates`), and the highest
 * shop rate among the order's items for the shop's own points.
 */
export function orderPointRows(
  rows: BreakdownRow[],
  benefits: Benefit[],
  rates: Record<string, number>,
  lineItems: LineItem[],
): Pick<OrderCardPoints, "rows" | "rate" | "campaigns"> {
  const benefitsById = new Map(benefits.map((benefit) => [benefit.id, benefit]));
  const items = new Map(lineItems.map((item) => [item.id, item]));
  const lines = new Map<string, OrderPointRow & { rates: Map<string, number> }>();
  for (const row of rows) {
    const benefit = row.source === "shop-rate" ? undefined : benefitsById.get(row.source);
    const group = pointGroupOf(benefit ?? "shop-rate");
    const key = group === "campaign" ? row.source : group;
    const line = lines.get(key) ?? {
      key,
      group,
      label: group === "campaign" ? (benefit?.label ?? "ショップ倍率") : groupLabels[group],
      rate: 0,
      points: 0,
      rates: new Map<string, number>(),
    };
    const rate = benefit
      ? (rates[benefit.id] ?? 0)
      : (items.get(row.lineItemId)?.shopPointRate ?? 1) - 1;
    line.points += row.points;
    line.rates.set(row.source, Math.max(line.rates.get(row.source) ?? 0, rate));
    lines.set(key, line);
  }
  const ordered = [...lines.values()]
    .map(({ rates, ...line }) => ({
      ...line,
      rate: [...rates.values()].reduce((sum, rate) => sum + rate, 0),
    }))
    .sort((a, b) => POINT_GROUPS.indexOf(a.group) - POINT_GROUPS.indexOf(b.group));
  return {
    rows: ordered,
    rate: ordered.reduce((sum, line) => sum + line.rate, 0),
    campaigns: ordered.filter((line) => line.group === "campaign").map((line) => line.label),
  };
}

/** An order's points summed into the four point groups. */
export function groupTotalsOf(rows: OrderPointRow[]): Record<PointGroup, number> {
  const totals: Record<PointGroup, number> = { base: 0, spu: 0, marathon: 0, campaign: 0 };
  for (const row of rows) totals[row.group] += row.points;
  return totals;
}

/** The breakdown's points summed by item. */
function itemPointsOf(rows: BreakdownRow[]): Record<string, number> {
  const points: Record<string, number> = {};
  for (const row of rows) points[row.lineItemId] = (points[row.lineItemId] ?? 0) + row.points;
  return points;
}

const noBenefits: Benefit[] = [];
const benefitsAtom = atomFamily((planId: string) =>
  selectAtom(calculatedPlanAtom(planId), (plan) => plan?.benefits ?? noBenefits, deepEqual),
);
const noRates: Record<string, number> = {};
const ratesAtom = atomFamily((planId: string) =>
  selectAtom(planResultAtom(planId), (result) => result?.rates ?? noRates, deepEqual),
);
const heldEstimateAtom = atomFamily(
  ({ planId, orderId }: OrderKey) =>
    selectAtom(
      planResultAtom(planId),
      (result) => result?.heldEstimates.find((estimate) => estimate.orderId === orderId),
      deepEqual,
    ),
  sameOrderKey,
);

/**
 * Everything a card or a desktop row shows about its order's points. It only changes when this
 * order's figures do, so editing another order does not re-render it.
 */
export const orderCardPointsAtom = atomFamily(
  (key: OrderKey) =>
    selectAtom(
      atom((get): OrderCardPoints => {
        const counted = get(orderPointsAtom(key));
        const estimate = get(heldEstimateAtom(key));
        // Only the preview shows rows fully cut by a cap. Cards and the table omit their rates too.
        const rows = (estimate?.rows ?? counted.rows).filter((row) => row.points !== 0);
        return {
          ...orderPointRows(
            rows,
            get(benefitsAtom(key.planId)),
            estimate?.rates ?? get(ratesAtom(key.planId)),
            get(orderAtom(key))?.lineItems ?? [],
          ),
          total: rows.reduce((sum, row) => sum + row.points, 0),
          itemPoints: itemPointsOf(rows),
        };
      }),
      (points) => points,
      deepEqual,
    ),
  sameOrderKey,
);

/** Whether this order is the open one; only the order that opens or closes re-renders. */
export const isOpenAtom = atomFamily((orderId: string) =>
  atom((get) => get(openOrderIdAtom) === orderId),
);

/** Set when saving a change to an order failed; the card list or the desktop list shows it. */
export const orderSaveFailedAtom = atom(false);

/** Saves a change to an order and reports a failure through `orderSaveFailedAtom`. */
export function useSaveOrderChange() {
  const setFailed = useSetAtom(orderSaveFailedAtom);
  return useCallback(
    (operation: Promise<unknown>) => {
      setFailed(false);
      operation.catch(() => setFailed(true));
    },
    [setFailed],
  );
}

/**
 * Scrolls the window down as little as it can to show the bottom of `element`, where an opened
 * order keeps its buttons. It never scrolls the top of `top` off the window.
 */
export function revealBottom(element: Element, top: Element = element) {
  const below = element.getBoundingClientRect().bottom - window.innerHeight;
  if (below <= 0) return;
  const room = Math.max(top.getBoundingClientRect().top, 0);
  window.scrollBy({ top: Math.min(below, room), behavior: "smooth" });
}
/**
 * Saves the order a form describes with its shop (`saveOrderDraftAtom`), and resolves to whether
 * it was saved. `setFailed` shows a failure where the screen shows it: the editor in place, the
 * desktop list above its orders (`orderSaveFailedAtom`). A draft that is `undefined` (the form is
 * not valid) counts as a failure.
 */
export function useSaveOrderDraft(planId: string, setFailed: (failed: boolean) => void) {
  const saveOrderDraft = useSetAtom(saveOrderDraftAtom);
  return useCallback(
    async (draft: OrderDraft | undefined, isNew: boolean) => {
      setFailed(draft === undefined);
      if (!draft) return false;
      try {
        await saveOrderDraft({ planId, draft, isNew });
        return true;
      } catch {
        setFailed(true);
        return false;
      }
    },
    [planId, setFailed, saveOrderDraft],
  );
}

export function taxRateLabel(rate: number) {
  return rate === 0 ? "非課税" : `${Math.round(rate * 100)}%`;
}

/** Each choice of a tax rate or of how an order is entered, drawn shorter than 44px and pressed 44px. */
export const segmentPressArea = {
  "& label::before": {
    content: '""',
    position: "absolute",
    insetInline: "0",
    insetBlock: "min(0px, calc((100% - 44px) / 2))",
  },
} as const;

export function taxLabel(items: LineItem[]) {
  return [...new Set(items.map((item) => item.taxRate))].map(taxRateLabel).join("・");
}

export function orderTitle(order: Order) {
  const [first] = order.lineItems;
  const rest = order.lineItems.length - 1;
  return `${first?.name ?? ""}${rest > 0 ? ` 他${rest}点` : ""}`;
}

export function useShopName(order: Order | undefined) {
  const shops = useAtomValue(shopsAtom);
  if (!order) return "不明なショップ";
  if (order.shopId === undefined) return "ショップ未入力";
  const shop = shops.find((shop) => shop.id === order.shopId);
  return shop ? shop.name : "不明なショップ";
}

/** A campaign that gave the order points, as a small display-only chip. */
export function CampaignChip({ children }: { children: ReactNode }) {
  return (
    <Tag as="span" size="sm" variant="outline" fullRounded>
      {children}
    </Tag>
  );
}

/** What turning 購入決定 off does, shown on the column's heading and read with each switch. */
export const HOLD_HINT =
  "オフにすると保留になり、買い回りの店舗数とポイントに数えません。買うか迷っている注文に使います。";

/** An order's position among the counted orders, or 「保留」 for a held order. */
export function OrderBadge({ badge }: { badge: number | null }) {
  return badge === null ? (
    <Badge variant="outline" colorScheme="gray" fullRounded flex="none" justifySelf="center">
      保留
    </Badge>
  ) : (
    <Badge
      colorScheme="mono"
      variant="solid"
      fullRounded
      flex="none"
      justifySelf="center"
      fontVariantNumeric="tabular-nums"
    >
      {badge}
    </Badge>
  );
}

export function HeaderButton(props: {
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="lg"
      colorScheme="gray"
      aria-pressed={props.pressed}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </Button>
  );
}

/** 「注文 N件（保留 M）」. Focus goes here after an order is deleted. */
export function OrdersHeading({
  orders,
  headingRef,
  id,
  small = false,
}: {
  orders: Order[];
  headingRef: RefObject<HTMLHeadingElement | null>;
  id?: string;
  /** In the table's header row, among the column labels. */
  small?: boolean;
}) {
  const heldCount = orders.filter((order) => order.onHold).length;
  return (
    <Heading
      as="h2"
      fontSize="md"
      data-small={dataAttr(small)}
      css={{ "&[data-small]": { fontSize: "xs" } }}
      ref={headingRef}
      tabIndex={-1}
      id={id}
    >
      注文{" "}
      <Text
        as="span"
        fontWeight="normal"
        fontSize="sm"
        color="fg.muted"
        css={{ "[data-small] > &": { fontSize: "xs" } }}
      >
        {orders.length}件{heldCount > 0 ? `（保留 ${heldCount}）` : ""}
      </Text>
    </Heading>
  );
}

export function SaveFailedAlert() {
  const failed = useAtomValue(orderSaveFailedAtom);
  return failed ? (
    <Text role="alert" fontSize="sm" color="danger.fg">
      変更を保存できませんでした。もう一度お試しください。
    </Text>
  ) : null;
}

type Confirm = { kind: "delete"; orderId: string } | { kind: "reset" };

/**
 * The confirmation before deleting one order or all of them. After either, focus goes to
 * `headingRef`, since the order (or every order) is gone.
 */
export function useOrderConfirm(plan: Plan, headingRef: RefObject<HTMLElement | null>) {
  const removeOrder = useSetAtom(removeOrderAtom);
  const clearOrders = useSetAtom(clearOrdersAtom);
  const save = useSaveOrderChange();
  const { open, onOpen, onClose } = useDisclosure();
  const [confirm, setConfirm] = useState<Confirm>();
  const finalFocus = useRef<HTMLElement | null>(null);

  const ask = useCallback(
    (next: Confirm) => {
      setConfirm(next);
      finalFocus.current = null;
      onOpen();
    },
    [onOpen],
  );
  const askDelete = useCallback((orderId: string) => ask({ kind: "delete", orderId }), [ask]);
  const askReset = useCallback(() => ask({ kind: "reset" }), [ask]);

  const target =
    confirm?.kind === "delete"
      ? plan.orders.find((order) => order.id === confirm.orderId)
      : undefined;
  const targetShop = useShopName(target);

  const dialog = (
    <Modal.Root
      open={open}
      title={confirm?.kind === "reset" ? "注文をすべて削除しますか？" : "注文を削除しますか？"}
      body={
        <Text>
          {confirm?.kind === "reset"
            ? `このプランの注文${plan.orders.length}件がすべて消えます。この操作は取り消せません。`
            : `「${targetShop}」の注文が消えます。この操作は取り消せません。`}
        </Text>
      }
      cancel="キャンセル"
      success={{ children: "削除する", colorScheme: "danger" }}
      finalFocusRef={finalFocus}
      onClose={onClose}
      onCancel={onClose}
      onSuccess={() => {
        if (confirm?.kind === "reset") save(clearOrders({ planId: plan.id }));
        if (confirm?.kind === "delete") {
          save(removeOrder({ planId: plan.id, orderId: confirm.orderId }));
        }
        onClose();
        finalFocus.current = headingRef.current;
      }}
    />
  );
  return { askDelete, askReset, dialog };
}
