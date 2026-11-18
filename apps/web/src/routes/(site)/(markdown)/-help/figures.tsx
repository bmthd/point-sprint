import type { Order, Plan } from "@workspaces/domain";
import { Card, List } from "@workspaces/ui";
import { useHydrateAtoms } from "jotai/utils";
import type { ComponentType } from "react";
import { useCapLines } from "#/routes/(plan)/-cap-lines.ts";
import { CapList } from "#/routes/(plan)/-plan-home/cap-list.tsx";
import { OrderCard } from "#/routes/(plan)/-plan-home/order-card.tsx";
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

/**
 * A numbered mark on a figure. `selector` finds what it marks, inside the figure, by CSS, so the
 * mark is drawn with the figure ahead of time. The sample is fixed, so the place in the component
 * is too: `text` is what the marked element holds, and the tests check that the selector finds
 * exactly one element holding it. Count with `:first-of-type` and `:nth-of-type`, not
 * `:first-child`: in the HTML rendered ahead of time, emotion puts `<style>` among the children.
 * Leave `:has()` out: the figure finds what holds a mark with `:has(selector)`, which cannot hold
 * another.
 */
export type HelpFigureMark = {
  selector: string;
  text: string;
  /**
   * How far the outline stands off what it marks, 5px by default: less where something else is
   * that close, below 0 to draw it inside, between rows with no room between them.
   */
  offset?: number;
};

export type HelpFigureSpec = {
  name: string;
  /** What the picture shows, read in place of the components drawn in it. */
  label: string;
  caption: string;
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

/** The held order's card on the phone's list, opened. */
function HeldOrderFigure() {
  useHydrateAtoms([[openOrderIdAtom, HELD_ORDER.id]]);
  const count = THIRD_MARATHON.orders.length;
  return (
    <List.Root gap="3">
      <OrderCard
        planId={THIRD_MARATHON.id}
        orderId={HELD_ORDER.id}
        badge={null}
        index={count - 1}
        count={count}
        onEdit={ignore}
        onDelete={ignore}
      />
    </List.Root>
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

const figures: HelpFigureSpec[] = [
  {
    name: "event",
    label:
      "トップページのイベントの欄。開催中のお買い物マラソン第三弾のカードと「プランを作る」のボタン",
    caption: "トップページのイベント",
    render: EventFigure,
    marks: [
      { selector: "ul > li button", text: "プランを作る" },
      { selector: ".ui-grid > .ui-flex > .ui-button", text: "終了したイベント" },
    ],
  },
  {
    name: "new-order",
    label: "注文を追加する画面。金額とショップを入れると、この注文で増えるポイントが出る",
    caption: "8店舗目になる ¥3,300 の注文を入れたところ",
    render: () => <NewOrderFigure plan={THIRD_MARATHON} price={3300} shopName="雑貨 そよかぜ" />,
    marks: [
      { selector: "[role=status][aria-label=ポイントの目安]", text: "+840P" },
      { selector: "ul[aria-label=上限への入り方]", text: "で使い切る" },
    ],
  },
  {
    name: "plan",
    label: "トップページの「自分のプラン」。最新のプランの獲得予定と、すべてのプランを開くボタン",
    caption: "トップページの「自分のプラン」",
    render: PlanSection,
    marks: [{ selector: "button[aria-label^=すべてのプラン]", text: "すべて" }],
  },
  {
    name: "edit-order",
    label: "注文を編集する画面で「条件」を開いたところ。注文日の欄と「同じショップの商品を追加」",
    caption: "注文の編集で「条件」を開いたところ",
    render: () => <EditOrderFigure plan={THIRD_MARATHON} order={FIRST_ORDER} />,
    marks: [
      { selector: ".ui-native-accordion__panel .ui-field__root:nth-of-type(2)", text: "注文日" },
      { selector: ".ui-native-accordion__panel .ui-button", text: "同じショップの商品を追加" },
    ],
  },
  {
    name: "caps",
    label:
      "プランの画面の「上限までの残り」。特典ごとに、ほかのプランとこのプランで使った分のゲージと、上限に届く金額が並び、下に上限に届いた特典が並ぶ",
    caption: "プランの画面の「上限までの残り」",
    render: CapsFigure,
    marks: [
      { selector: "ul:first-of-type > li:first-of-type", text: "楽天カード特典分" },
      { selector: "ul:last-of-type > li:first-of-type", text: "楽天モバイル" },
    ],
  },
  {
    name: "held-order",
    label: "保留にした注文の行。ポイントに取り消し線が引かれ、「購入決定」のスイッチがオフ",
    caption: "プランの画面で、保留にした注文の行を開いたところ",
    render: HeldOrderFigure,
    marks: [
      { selector: "button > span:nth-of-type(3)", text: "保留中" },
      { selector: "ul[aria-label^=購入決定] + div", text: "購入決定", offset: 2 },
    ],
  },
  {
    name: "spu-card",
    label: "プランの画面の SPU。10月のポイント倍率と「変更」のボタン",
    caption: "プランの画面の「SPU の設定」",
    render: SpuCardFigure,
    marks: [{ selector: "button[aria-label='10月の SPU を変更']", text: "変更" }],
  },
  {
    name: "spu-months",
    label: "共通設定の「月ごとの SPU」。今月と来月のポイント倍率と、それぞれの「変更」のボタン",
    caption: "共通設定の「月ごとの SPU」",
    render: SpuMonthsCard,
    marks: [{ selector: "h2 + p + div", text: "10月から引き継ぎ" }],
  },
  {
    name: "spu-month-top",
    label: "10月の SPU の画面。ポイント倍率と、契約・お支払いで決まる項目のタイル",
    caption: "10月の SPU の画面",
    render: SpuMonthFigure,
    marks: [
      { selector: ".ui-card__body > section:nth-of-type(1)", text: "翌月に引継" },
      { selector: ".ui-card__body > section:nth-of-type(2)", text: "毎月リセット" },
    ],
  },
  {
    name: "spu-month-bottom",
    label:
      "10月の SPU の画面の下。ほかに 10月の注文があるプランとして、お買い物マラソン第二弾。上限に達した項目の印の説明",
    caption: "10月の SPU の画面の下",
    render: SpuMonthFigure,
    marks: [
      { selector: "section[aria-label^=ほかに] a", text: "第二弾" },
      { selector: "section[aria-label^=ほかに] + div", text: "このプランで上限に達した" },
    ],
    crop: { height: 180, from: "bottom" },
  },
  {
    name: "sync",
    label:
      "共通設定の「ほかの端末と同期」。「パスキーで同期を始める」と「ほかの端末で始めた同期にログイン」のボタン",
    caption: "共通設定の「ほかの端末と同期」",
    render: SyncFigure,
    marks: [
      {
        selector: ".ui-card__body > button:nth-of-type(1)",
        text: "パスキーで同期を始める",
        offset: 0,
      },
      {
        selector: ".ui-card__body > button:nth-of-type(2)",
        text: "ほかの端末で始めた同期にログイン",
        offset: 0,
      },
      { selector: ".ui-card__body > p:last-of-type", text: "復元用のコードで戻す", offset: 0 },
    ],
  },
];

/** The figures the help draws, by the name `:::figure` gives. */
export const helpFigures: Record<string, HelpFigureSpec> = Object.fromEntries(
  figures.map((figure) => [figure.name, figure]),
);
