// マスタの倍率と上限を、どこから写したか。計算方法のページ（/calculation）がこの表を出す。
// 倍率や上限を直したら、ここの確認日も直す。
import type { Benefit } from "../model/benefit";
import { BANK_CARD_ID, BANK_SALARY_ID } from "./spu";

export type BenefitSource =
  /** 楽天の公式の案内。`checkedOn` はその値を確かめた日（YYYY-MM-DD）。 */
  | { kind: "official"; title: string; url: string; checkedOn: string }
  /** 楽天の公式の案内がなく、ほかのサイトを参考にした。 */
  | { kind: "unofficial"; title: string; url: string; checkedOn: string }
  /** 倍率や上限を利用者が入れるので、写した元がない。 */
  | { kind: "user-entered" };

export type OfficialSource = Extract<BenefitSource, { kind: "official" }>;

const official = (title: string, url: string, checkedOn: string): OfficialSource => ({
  kind: "official",
  title,
  url,
  checkedOn,
});

/** The page every SPU item is copied from. */
export const SPU_PAGE = {
  title: "楽天市場 SPU（スーパーポイントアッププログラム）",
  url: "https://event.rakuten.co.jp/campaign/point-up/everyday/point/",
} as const;

/** SPU の項目の出典。どれも SPU のページで、楽天銀行の 2 つだけ後から確かめ直した。 */
export const spuSource = (benefit: Benefit): OfficialSource =>
  official(
    SPU_PAGE.title,
    SPU_PAGE.url,
    benefit.id === BANK_CARD_ID || benefit.id === BANK_SALARY_ID ? "2026-10-19" : "2026-10-04",
  );

/** キャンペーンのテンプレートの出典。キーはテンプレートの id。 */
export const campaignSources: Readonly<Record<string, BenefitSource>> = {
  pointday: official(
    "楽天市場 5と0のつく日",
    "https://event.rakuten.co.jp/campaign/card/pointday/",
    "2026-10-04",
  ),
  "thanks-day": official(
    "楽天市場 ご愛顧感謝デー",
    "https://event.rakuten.co.jp/campaign/rank/point/",
    "2026-10-17",
  ),
  wonderfulday: official(
    "楽天市場 ワンダフルデー",
    "https://event.rakuten.co.jp/campaign/point-up/wonderfulday/",
    "2026-10-17",
  ),
  "sports-win": official(
    "楽天市場 勝ったら倍",
    "https://event.rakuten.co.jp/campaign/sports/",
    "2026-10-11",
  ),
  "39shop": official(
    "楽天市場 39ショップ",
    "https://event.rakuten.co.jp/guide/freeshippingline/campaign/",
    "2026-10-04",
  ),
  repeat: {
    kind: "unofficial",
    title: "アプリオ「楽天市場のリピート購入キャンペーン」",
    url: "https://appllio.com/rakuten-repeat-purchase",
    checkedOn: "2026-10-04",
  },
  "24h": official(
    "楽天市場 24時間限定（2026年10月10日の回）",
    "https://event.rakuten.co.jp/incentive/ichiba/henbai/24h/2026101010x/",
    "2026-10-17",
  ),
  "2shop": official(
    "楽天市場 2ショップ購入キャンペーン",
    "https://event.rakuten.co.jp/campaign/point-up/2shop3/",
    "2026-10-17",
  ),
  "shop-around-manual": { kind: "user-entered" },
  pointback: official(
    "楽天市場 超ポイントバック祭（2026年5月19日〜20日の回）",
    "https://event.rakuten.co.jp/campaign/pointback/",
    "2026-10-17",
  ),
  "spend-tiers-manual": { kind: "user-entered" },
  "custom-rate": { kind: "user-entered" },
};
