import {
  type Benefit,
  type BreakdownRow,
  type LineItem,
  type Order,
  POINT_GROUPS,
  type Plan,
  type PointGroup,
  pointGroupOf,
  tierRate,
} from "@workspaces/domain";
import { Badge, Button, Heading, Modal, Tag, Text, useDisclosure } from "@workspaces/ui";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { atomFamily } from "jotai-family";
import { selectAtom } from "jotai/utils";
import { type ReactNode, type RefObject, useCallback, useRef, useState } from "react";
import {
  deepEqual,
  orderAtom,
  orderPointsAtom,
  planAtom,
  planResultAtom,
} from "../../state/derived";
import { clearOrdersAtom, removeOrderAtom } from "../../state/order-ops";
import { shopsAtom } from "../../state/queries";
import { openOrderIdAtom } from "../../state/ui";

// What the phone's order cards and the desktop's order list have in common.

/** Rakuten's service and campaign images are served from R2, not kept in the repository. */
const IMAGE_ORIGIN = "https://assets.bmth.dev/point-sprint";

/** A benefit's `imagePath` (`/img/...`) → the URL its image is served from. */
export const imageUrl = (imagePath: string) => `${IMAGE_ORIGIN}${imagePath}`;

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

export type OrderCardPoints = {
  rows: OrderPointRow[];
  total: number;
  /** The sum of the rows' rates. */
  rate: number;
  /** Labels of the campaigns that gave the order points. */
  campaigns: string[];
  /** For a held order, how many points counting it again would add. */
  estimate: number | undefined;
};

const groupLabels: Record<Exclude<PointGroup, "campaign">, string> = {
  base: "通常",
  spu: "SPU",
  marathon: "マラソン",
};

const benefitRate = (benefit: Benefit, shopCount: number) =>
  benefit.kind === "shop-around" ? tierRate(benefit.params.tiers, shopCount) : benefit.params.rate;

/**
 * Groups an order's breakdown rows into the lines shown on its card. A row's rate is the sum of the
 * nominal rates of the benefits behind it: the shop-around tier at the plan's shop count, and the
 * highest shop rate among the order's items for the shop's own points.
 */
export function orderPointRows(
  rows: BreakdownRow[],
  benefits: Benefit[],
  shopCount: number,
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
      ? benefitRate(benefit, shopCount)
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
export const groupTotalsOf = (rows: OrderPointRow[]): Record<PointGroup, number> => {
  const totals: Record<PointGroup, number> = { base: 0, spu: 0, marathon: 0, campaign: 0 };
  for (const row of rows) totals[row.group] += row.points;
  return totals;
};

const noBenefits: Benefit[] = [];
const benefitsAtom = atomFamily((planId: string) =>
  selectAtom(planAtom(planId), (plan) => plan?.benefits ?? noBenefits, deepEqual),
);
const shopCountAtom = atomFamily((planId: string) =>
  selectAtom(planResultAtom(planId), (result) => result?.shopCount ?? 0),
);
const heldEstimateAtom = atomFamily(
  ({ planId, orderId }: OrderKey) =>
    selectAtom(
      planResultAtom(planId),
      (result) => result?.heldEstimates.find((estimate) => estimate.orderId === orderId)?.points,
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
        const { rows, total } = get(orderPointsAtom(key));
        const lines = orderPointRows(
          rows,
          get(benefitsAtom(key.planId)),
          get(shopCountAtom(key.planId)),
          get(orderAtom(key))?.lineItems ?? [],
        );
        return { ...lines, total, estimate: get(heldEstimateAtom(key)) };
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

export const yen = (value: number) => `¥${value.toLocaleString("ja-JP")}`;
export const pointsText = (value: number) => `${value.toLocaleString("ja-JP")}P`;
export const rateText = (rate: number, plus = true) =>
  `${plus ? "+" : ""}${Number(rate.toFixed(2)).toLocaleString("ja-JP")}倍`;

export const taxRateLabel = (rate: number) =>
  rate === 0 ? "非課税" : `${Math.round(rate * 100)}%`;

export const taxLabel = (items: LineItem[]) =>
  [...new Set(items.map((item) => item.taxRate))].map(taxRateLabel).join("・");

export const orderTitle = (order: Order) => {
  const [first] = order.lineItems;
  const rest = order.lineItems.length - 1;
  return `${first?.name ?? ""}${rest > 0 ? ` 他${rest}点` : ""}`;
};

export function useShopName(shopId: string) {
  const shops = useAtomValue(shopsAtom);
  return shops.find((shop) => shop.id === shopId)?.name ?? "不明なショップ";
}

/** A campaign that gave the order points, as a small display-only chip. */
export function CampaignChip({ children }: { children: ReactNode }) {
  return (
    <Tag as="span" size="sm" variant="outline" fullRounded>
      {children}
    </Tag>
  );
}

/** An order's position among the counted orders, or 「保留」 for a held order. */
export function OrderBadge({ badge }: { badge: number | null }) {
  return badge === null ? (
    <Badge
      data-badge="order"
      variant="outline"
      colorScheme="gray"
      fullRounded
      flex="none"
      justifySelf="center"
    >
      保留
    </Badge>
  ) : (
    <Badge
      data-badge="order"
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
}: {
  orders: Order[];
  headingRef: RefObject<HTMLHeadingElement | null>;
  id?: string;
}) {
  const heldCount = orders.filter((order) => order.onHold).length;
  return (
    <Heading as="h2" fontSize="md" ref={headingRef} tabIndex={-1} id={id}>
      注文{" "}
      <Text as="span" fontWeight="normal" fontSize="sm" color="fg.muted">
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
  const targetShop = useShopName(target?.shopId ?? "");

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
