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

/** The marks shared by the Markdown validator and the figure renderer, without UI imports. */
export const helpFigureMarks: Record<string, HelpFigureMark[]> = {
  event: [
    { selector: "ul > li button", text: "プランを作る" },
    { selector: ".ui-grid > .ui-flex > .ui-button", text: "終了したイベント" },
  ],
  "new-order": [
    { selector: "[role=status][aria-label=ポイントの目安]", text: "+840P" },
    { selector: "ul[aria-label=上限への入り方]", text: "で使い切る" },
  ],
  plan: [{ selector: "button[aria-label^=すべてのプラン]", text: "すべて" }],
  "edit-order": [
    { selector: ".ui-native-accordion__panel .ui-field__root:nth-of-type(2)", text: "注文日" },
    { selector: ".ui-native-accordion__panel .ui-button", text: "同じショップの商品を追加" },
  ],
  caps: [
    { selector: "ul:first-of-type > li:first-of-type", text: "楽天カード特典分" },
    { selector: "ul:last-of-type > li:first-of-type", text: "楽天モバイル" },
  ],
  "held-order": [
    { selector: "button > span:nth-of-type(3)", text: "保留中" },
    { selector: "ul[aria-label^=購入決定] + div", text: "購入決定", offset: 2 },
  ],
  "spu-card": [{ selector: "button[aria-label='10月の SPU を変更']", text: "変更" }],
  "spu-months": [{ selector: "h2 + p + div", text: "10月から引き継ぎ" }],
  "spu-month-top": [
    { selector: ".ui-card__body > section:nth-of-type(1)", text: "翌月に引継" },
    { selector: ".ui-card__body > section:nth-of-type(2)", text: "毎月リセット" },
  ],
  "spu-month-bottom": [
    { selector: "section[aria-label^=ほかに] a", text: "第二弾" },
    { selector: "section[aria-label^=ほかに] + div", text: "このプランで上限に達した" },
  ],
  sync: [
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
};
