/** One notice: when it was posted, its title, and its paragraphs. */
export type Notice = {
  /** `YYYY-MM-DD`. */
  date: string;
  title: string;
  body: readonly string[];
};

/**
 * Every notice. The ones dated 2023 are from the old site, kept as they were posted: they describe
 * the old site's screens, not this one's.
 */
export const notices: readonly Notice[] = [
  {
    date: "2023-11-24",
    title: "PC版で行の並べ替えに対応しました",
    body: [
      "PC版で、行の並べ替え機能に対応しました✨",
      "ドラッグ&ドロップで行の並べ替えができます。",
      "ぜひお試しください！",
    ],
  },
  {
    date: "2023-10-02",
    title: "買い回り還元上限設定機能をリリースしました",
    body: [
      "獲得上限の変動に対応できるように、買い回り還元上限設定機能をリリースしました！",
      "デフォルトで7000ポイントになっているので、5000ポイントの回などは手動で変更してください。",
    ],
  },
  {
    date: "2023-09-01",
    title: "お買い物マラソンの獲得上限を7000ポイントに戻しました",
    body: [
      "現在、獲得上限の変更に対応できるトグルスイッチを作成中です。",
      "完成するまでの暫定的な措置として獲得上限を7000ポイントに戻しています。",
    ],
  },
  {
    date: "2023-08-24",
    title: "お買い物マラソンの獲得上限を変更しました",
    body: ["獲得上限変更に伴い、お買い物マラソンの最大ポイントを5000に変更しました。"],
  },
];

/** The notices, newest first. */
export const newestFirst = (list: readonly Notice[]): Notice[] =>
  list.toSorted((a, b) => b.date.localeCompare(a.date));

/** "2023-11-24" → "2023/11/24", as the old site wrote it. */
export const formatNoticeDate = (date: string) => date.replaceAll("-", "/");
