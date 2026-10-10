export type Notice = {
  /** The anchor of the notice on `/notices`: lowercase letters, digits and hyphens. */
  id: string;
  /** The day it was posted, as `YYYY-MM-DD` in Japan. */
  date: string;
  title: string;
  /** Plain text. A blank line starts a new paragraph. */
  body: string;
};

/**
 * Every notice. Adding one here is all it takes: `/notices` and the sidebar put them newest first,
 * whatever the order here.
 */
export const notices: readonly Notice[] = [
  {
    id: "rebuilt",
    date: "2026-10-08",
    title: "ポイントスプリントを作り直しました",
    body: `お買い物マラソンで買う予定の注文を並べると、獲得できるポイント、還元率、買いまわりの店舗数がその場で分かる計算ツールとして作り直しました。

プランはイベントごとにいくつでも作れます。達成している SPU とよく買うショップをプロフィールに登録しておくと、新しく作るプランに最初から入ります。

入力した内容はこのブラウザの中にだけ保存されます。使い方は「使い方・注意事項」をご覧ください。`,
  },
];

/** Newest first. Notices of the same day keep the order they are listed in. */
export const newestFirst = (list: readonly Notice[]): Notice[] =>
  list.toSorted((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

/** The paragraphs of a notice's body. */
export const paragraphs = (body: string): string[] =>
  body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
