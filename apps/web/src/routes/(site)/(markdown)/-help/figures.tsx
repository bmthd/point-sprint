import type { Order, Plan } from "@workspaces/domain";
import { Card } from "@workspaces/ui";
import { useHydrateAtoms } from "jotai/utils";
import type { ComponentType } from "react";
import { useCapLines } from "#/routes/(plan)/-cap-lines.ts";
import { CapList } from "#/routes/(plan)/-plan-home/cap-list.tsx";
import { OrderCard } from "#/routes/(plan)/-plan-home/order-card.tsx";
import { OrderListTable } from "#/routes/(plan)/-plan-home/order-list.tsx";
import { SpuMonthsCard } from "#/routes/(plan)/-settings/spu-months-card.tsx";
import { SyncSettings } from "#/routes/(plan)/-settings/sync-settings.tsx";
import { SpuMonthEditor } from "#/routes/(plan)/-spu-month/spu-month-editor.tsx";
import { SpuSettingsCard } from "#/routes/(plan)/-spu-month/spu-month-rows.tsx";
import { openOrderIdAtom } from "#/routes/(plan)/-ui.ts";
import { EventSection } from "#/routes/(site)/-top/event-section.tsx";
import { PlanSection } from "#/routes/(site)/-top/plan-section.tsx";
import { DEFAULT_ACCOUNT_ID } from "@workspaces/domain";
import { EditOrderFigure, NewOrderFigure } from "./order-editor-figure.tsx";
import { SAMPLE_PLANS, SAMPLE_TODAY } from "./sample-data.ts";
import { type HelpFigureMark, helpFigureMarks } from "./figure-marks.ts";

export type HelpFigureSpec = {
  name: string;
  render: ComponentType;
  /** The marks, numbered from 1 in this order. */
  marks: HelpFigureMark[];
  /** Only this many pixels of the phone, from its top or its bottom, for a long screen. */
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

/** 「上限までの残り」 of the third marathon, as its plan page shows it. */
function CapsFigure() {
  const lines = useCapLines(THIRD_MARATHON);
  return (
    <Card.Root>
      <Card.Body alignItems="stretch">
        <CapList
          lines={lines}
          today={SAMPLE_TODAY}
          period={THIRD_MARATHON.period}
          taxRate={0.1}
          onTaxRate={ignore}
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

/** The plan page's SPU, under the red card. */
function SpuCardFigure() {
  return (
    <SpuSettingsCard
      plan={THIRD_MARATHON}
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
  },
  {
    name: "plan",
    render: PlanSection,
  },
  {
    name: "edit-order",
    render: () => <EditOrderFigure plan={THIRD_MARATHON} order={FIRST_ORDER} />,
  },
  {
    name: "caps",
    render: CapsFigure,
  },
  {
    name: "held-order",
    render: HeldOrderFigure,
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
