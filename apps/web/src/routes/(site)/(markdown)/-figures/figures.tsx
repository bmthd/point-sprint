import type { Order, Plan } from "@workspaces/domain";
import { useHydrateAtoms } from "jotai/utils";
import { useState } from "react";
import type { ComponentType } from "react";
import { useAtomValue } from "jotai";
import { calculatedPlanAtom, planResultAtom } from "#/state/derived.ts";
import { CapList } from "#/routes/(plan)/-plan-home/cap-list.tsx";
import { OrderCard } from "#/routes/(plan)/-plan-home/order-card.tsx";
import { OrderAddRow } from "#/routes/(plan)/-plan-home/order-add-row.tsx";
import { OrderListTable } from "#/routes/(plan)/-plan-home/order-list.tsx";
import { OrderTable } from "#/routes/(plan)/-plan-home/order-table.tsx";
import { SpuMonthsCard } from "#/routes/(plan)/-settings/spu-months-card.tsx";
import { SyncSettings } from "#/routes/(plan)/-settings/sync-settings.tsx";
import { SpuMonthEditor } from "#/routes/(plan)/-spu-month/spu-month-editor.tsx";
import { SpuSettingsCard } from "#/routes/(plan)/-spu-month/spu-month-rows.tsx";
import { openOrderIdAtom } from "#/routes/(plan)/-ui.ts";
import { EventSection } from "#/routes/(site)/-top/event-section.tsx";
import { PlanSection } from "#/routes/(site)/-top/plan-section.tsx";
import { DEFAULT_ACCOUNT_ID, capLines } from "@workspaces/domain";
import { Card, List } from "@workspaces/ui";
import { emptyInputForDate, emptyItem } from "#/routes/(plan)/-order-form.ts";
import { EditOrderFigure, NewOrderFigure } from "./order-editor-figure.tsx";
import { SAMPLE_PLANS, SAMPLE_TODAY } from "./sample-data.ts";
import { type HelpFigureMark, helpFigureMarks } from "./figure-marks.ts";

/**
 * Which screen a figure shows: `phone` below the plan page's two columns, `wide` with them, as the
 * plan page lays itself out differently there. Without it, the figure shows on both.
 */
export type HelpFigureScreen = "phone" | "wide";

export type HelpFigureSpec = {
  name: string;
  render: ComponentType;
  screen?: HelpFigureScreen;
  /** What of the screen is left out, by CSS: a table's other rows. */
  hide?: string[];
  /** The marks, numbered from 1 in this order. */
  marks: HelpFigureMark[];
  /** Only this many pixels of the screen, from its top or its bottom, for a long one. */
  crop?: { height: number; from: "top" | "bottom" };
};

function samplePlan(index: number): Plan {
  const plan = SAMPLE_PLANS[index];
  if (!plan) throw new Error(`The sample has no plan ${index}.`);
  return plan;
}

function sampleOrder(plan: Plan, index: number): Order {
  const order = plan.orders.at(index);
  if (!order) throw new Error(`${plan.name} has no order ${index}.`);
  return order;
}

const THIRD_MARATHON = samplePlan(0);
const FIRST_ORDER = sampleOrder(THIRD_MARATHON, 0);
const HELD_ORDER = sampleOrder(THIRD_MARATHON, -1);
const MONTH = THIRD_MARATHON.period.start.slice(0, 7);

const ignore = () => {};

/** The top page's events, on the third marathon's last day. */
function EventFigure() {
  return (
    <EventSection
      today={SAMPLE_TODAY}
      disabled={false}
      onCreate={ignore}
      onCreateWithoutEvent={ignore}
      failed={false}
    />
  );
}

/** 「上限までの残り」 of the third marathon, as its plan page shows it: a table on a wide screen. */
function CapsFigure({ table = false }: { table?: boolean }) {
  const calculated = useAtomValue(calculatedPlanAtom(THIRD_MARATHON.id));
  const capResult = useAtomValue(planResultAtom(THIRD_MARATHON.id));
  const lines = calculated && capResult ? capLines(calculated, capResult) : [];
  return (
    <Card.Root>
      <Card.Body alignItems="stretch">
        <CapList
          lines={lines}
          today={SAMPLE_TODAY}
          period={THIRD_MARATHON.period}
          taxRate={0.1}
          onTaxRate={ignore}
          table={table}
        />
      </Card.Body>
    </Card.Root>
  );
}

/** The held order's row on the phone's list, opened. */
function HeldOrderFigure() {
  useHydrateAtoms([[openOrderIdAtom, HELD_ORDER.id]]);
  const count = THIRD_MARATHON.orders.length;
  return (
    <OrderListTable>
      <OrderCard
        planId={THIRD_MARATHON.id}
        orderId={HELD_ORDER.id}
        badge={null}
        index={count - 1}
        count={count}
        onEdit={ignore}
        onDelete={ignore}
      />
    </OrderListTable>
  );
}

/**
 * The desktop table of the third marathon with only `order`'s row, opened. The row reads its points
 * from the whole plan in the store; the table is given the one order, so the others are not drawn.
 */
function OpenRowFigure({ order }: { order: Order }) {
  useHydrateAtoms([[openOrderIdAtom, order.id]]);
  return <OrderTable planId={THIRD_MARATHON.id} orderIds={[order.id]} head={null} />;
}

/** The desktop table's last row, a new order of `price` yen being typed, with its conditions open. */
function NewOrderRowFigure({ price }: { price: number }) {
  const [input] = useState(() => ({
    ...emptyInputForDate(SAMPLE_TODAY),
    items: [{ ...emptyItem(), unitPrice: String(price) }],
  }));
  return (
    <Card.Root overflow="hidden">
      <List.Root as="ol" gap="0">
        <OrderAddRow planId={THIRD_MARATHON.id} initialInput={input} initialOpen />
      </List.Root>
    </Card.Root>
  );
}

/**
 * What the one row's table leaves out: the count of its orders, which would be one, the row a new
 * order is typed in, the head above the card and the note under it.
 */
const OPEN_ROW_HIDE = [
  "h2 > span",
  "ol > li:not([data-order-id])",
  ".ui-flex:has(> article) > .ui-flex:first-of-type",
  "article ~ p",
];

/** The plan page's SPU, under the red card. */
function SpuCardFigure() {
  return (
    <SpuSettingsCard
      planId={THIRD_MARATHON.id}
      title="SPU の設定"
      note="注文の日付の月で決まります"
      onChange={ignore}
    />
  );
}

/** October's SPU, opened from the third marathon. */
function SpuMonthFigure() {
  return <SpuMonthEditor accountId={DEFAULT_ACCOUNT_ID} month={MONTH} planId={THIRD_MARATHON.id} />;
}

/** 「ほかの端末と同期」 before syncing starts. */
function SyncFigure() {
  return <SyncSettings siteKey="sample" />;
}

const figures: Omit<HelpFigureSpec, "marks">[] = [
  {
    name: "event",
    render: EventFigure,
  },
  {
    name: "new-order",
    render: () => <NewOrderFigure plan={THIRD_MARATHON} price={3300} shopName="雑貨 そよかぜ" />,
    screen: "phone",
  },
  {
    name: "plan",
    render: PlanSection,
  },
  {
    name: "edit-order",
    render: () => <EditOrderFigure plan={THIRD_MARATHON} order={FIRST_ORDER} />,
    screen: "phone",
  },
  {
    name: "edit-order-wide",
    render: () => <OpenRowFigure order={FIRST_ORDER} />,
    screen: "wide",
    hide: OPEN_ROW_HIDE,
    crop: { height: 830, from: "top" },
  },
  {
    name: "caps",
    render: CapsFigure,
    screen: "phone",
  },
  {
    name: "caps-wide",
    render: () => <CapsFigure table />,
    screen: "wide",
  },
  {
    name: "new-order-wide",
    render: () => <NewOrderRowFigure price={3300} />,
    screen: "wide",
  },
  {
    name: "held-order",
    render: HeldOrderFigure,
    screen: "phone",
  },
  {
    name: "held-order-wide",
    render: () => <OpenRowFigure order={HELD_ORDER} />,
    screen: "wide",
    hide: OPEN_ROW_HIDE,
    crop: { height: 222, from: "top" },
  },
  {
    name: "spu-card",
    render: SpuCardFigure,
  },
  {
    name: "spu-months",
    render: SpuMonthsCard,
  },
  {
    name: "spu-month-top",
    render: SpuMonthFigure,
  },
  {
    name: "spu-month-bottom",
    render: SpuMonthFigure,
    crop: { height: 180, from: "bottom" },
  },
  {
    name: "sync",
    render: SyncFigure,
  },
];

/** The figures the help draws, by the name `:::figure` gives. */
export const helpFigures: Record<string, HelpFigureSpec> = Object.fromEntries(
  figures.map((figure) => {
    const marks = helpFigureMarks[figure.name];
    if (!marks) throw new Error(`No marks are defined for ${figure.name}.`);
    return [figure.name, { ...figure, marks }];
  }),
);
