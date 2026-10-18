// 定例キャンペーンと、利用者が自分で作るキャンペーン（買いまわり（手動）、自由な倍率）のテンプレート。
// ユーザーが instantiateCampaign で自分のプランに取り込む。
// 出典: 設計書 3節「計算が従う楽天の規則」に書いた値と出典 URL を使う（各テンプレートのコメントに要点を再掲する）。
// 確認日: 2026-10-04
import type { CampaignTemplate } from "../model/campaign-template";
import type { ChannelId } from "../model/common";

const CHANNELS: ChannelId[] = ["rakuten-ichiba", "rakuten-books"];

export const campaignTemplates: CampaignTemplate[] = [
  {
    id: "pointday",
    name: "5と0のつく日",
    occurrence: "fixed",
    benefit: {
      id: "80a26572-df5d-4970-a83b-0dd4d0ab5940",
      kind: "rate-bonus",
      category: "campaign",
      label: "5と0のつく日",
      imagePath: "/img/campaign/pointday.webp",
      enabled: false,
      amountBasis: "tax-excluded",
      // 月ごとの獲得上限を、どのプランに入れても共有する。
      capScope: "month",
      sharedKey: "pointday",
      // 対象は楽天カード決済の購入。支払方法は conditions で表せないので、ユーザーが自分の購入に合わせて enabled を切り替える。
      conditions: {
        channels: [...CHANNELS],
        dateRule: { type: "daysOfMonth", days: [5, 10, 15, 20, 25, 30] },
      },
      params: { rate: 1, cap: 1000, roundingUnit: "item" },
    },
  },
  {
    id: "sports-win",
    name: "勝ったら倍",
    occurrence: "user-dates",
    benefit: {
      id: "e6cb1cc4-7941-4247-8917-c922e687ce23",
      kind: "rate-bonus",
      category: "campaign",
      label: "勝ったら倍",
      imagePath: "/img/campaign/sports.webp",
      enabled: false,
      amountBasis: "tax-excluded",
      // 上限は「キャンペーン開催ごとに 1,000 ポイント」。開催 1 回ごとに特典を 1 件作る。
      // 出典: https://event.rakuten.co.jp/campaign/sports/ （確認日 2026-10-11）
      capScope: "occurrence",
      sharedKey: "sports-win",
      // 既定は片方のチームの勝利（+1倍）。両チームが勝った日は rate: 2 で作る。日付はユーザーが入れる。
      conditions: { channels: [...CHANNELS], minOrderAmount: 1000 },
      params: { rate: 1, cap: 1000, roundingUnit: "item" },
    },
  },
  {
    id: "39shop",
    name: "39ショップ",
    occurrence: "user-period",
    benefit: {
      id: "2961c5d8-c22c-401f-a3b1-50596708d700",
      kind: "rate-bonus",
      category: "campaign",
      label: "39ショップ",
      imagePath: "/img/campaign/39shop.webp",
      enabled: false,
      // 対象額が税込か税抜かは、公式ページの記述が条件金額のことか読み切れない。
      // そのため amountBasis は既定（税抜）のままにしている。
      amountBasis: "tax-excluded",
      capScope: "campaign",
      sharedKey: "39shop",
      conditions: { channels: [...CHANNELS], shopTags: ["39shop"], minOrderAmount: 3980 },
      params: { rate: 1, cap: 3000, roundingUnit: "item" },
    },
  },
  {
    id: "repeat",
    name: "リピート購入",
    occurrence: "user-period",
    benefit: {
      id: "79fafb37-ec1f-4875-bb48-a300e70c0024",
      kind: "rate-bonus",
      category: "campaign",
      label: "リピート購入",
      imagePath: "/img/campaign/history.webp",
      enabled: false,
      amountBasis: "tax-excluded",
      capScope: "campaign",
      sharedKey: "repeat",
      // 出典: https://appllio.com/rakuten-repeat-purchase
      // 不定期のキャンペーンで、倍率・上限・条件金額は開催ごとに違う。
      // そのため上限は持たず、利用者が開催ごとに instantiateCampaign の cap などで入れる。
      conditions: { minOrderAmount: 3980, orderTags: ["repeat"] },
      params: { rate: 1, roundingUnit: "item" },
    },
  },
  {
    // 公式イベントのマスタ（D1）にない回のお買い物マラソンや楽天スーパーSALE に使う。
    id: "shop-around-manual",
    name: "買いまわり（手動）",
    occurrence: "user-period",
    benefit: {
      id: "0b7ed87d-ab15-48aa-9b94-9d84182b9d0a",
      kind: "shop-around",
      category: "campaign",
      label: "ショップ買いまわり",
      enabled: false,
      amountBasis: "tax-excluded",
      capScope: "campaign",
      sharedKey: "shop-around",
      conditions: {},
      params: {
        // 2〜10ショップで+1〜+9倍、獲得上限7,000ポイント（2026年10月のマラソンと同じ値）。
        tiers: [
          { minShops: 2, rate: 1 },
          { minShops: 3, rate: 2 },
          { minShops: 4, rate: 3 },
          { minShops: 5, rate: 4 },
          { minShops: 6, rate: 5 },
          { minShops: 7, rate: 6 },
          { minShops: 8, rate: 7 },
          { minShops: 9, rate: 8 },
          { minShops: 10, rate: 9 },
        ],
        cap: 7000,
        roundingUnit: "item",
      },
    },
  },
  {
    // 超ポイントバック祭。告知なしで始まり 2〜3 日で終わるので、公式イベントのマスタ（D1）に入る前の回を
    // 利用者が自分で足せるようにする。段階は回ごとに違うので、直近の回の値で足し、利用者が直す。
    // 出典: https://event.rakuten.co.jp/campaign/pointback/ （確認日 2026-10-17、2026-05-19〜20 の回）
    // 上限 5,000 ポイントは開催ごと。期間中の合計（税込、送料別、クーポン適用後）で段階が決まる。
    id: "pointback",
    name: "超ポイントバック祭",
    occurrence: "user-period",
    benefit: {
      id: "e069b199-a269-45da-9681-cea01a90f0ad",
      kind: "spend-tiers",
      category: "campaign",
      label: "超ポイントバック祭",
      enabled: false,
      amountBasis: "tax-excluded",
      capScope: "campaign",
      sharedKey: "pointback",
      conditions: {},
      params: {
        tiers: [
          { minAmount: 5000, rate: 1 },
          { minAmount: 10000, rate: 2 },
          { minAmount: 20000, rate: 3 },
          { minAmount: 40000, rate: 4 },
          { minAmount: 60000, rate: 5 },
        ],
        cap: 5000,
        roundingUnit: "item",
      },
    },
  },
  {
    // 期間中の合計額（税込）で倍率が決まるキャンペーン（超ポイントバック祭など）を、利用者が段階を入れて作る。
    // sharedKey がないので何度でも足せる。段階と上限は回ごとに違うので、足した後に利用者が直す。
    id: "spend-tiers-manual",
    name: "合計額で倍率（手動）",
    occurrence: "user-period",
    benefit: {
      id: "6f1d2a43-8c5e-4b7a-9d10-3e2f1a0b9c8d",
      kind: "spend-tiers",
      category: "campaign",
      label: "合計額で倍率",
      enabled: false,
      amountBasis: "tax-excluded",
      capScope: "plan",
      conditions: {},
      params: { tiers: [{ minAmount: 5000, rate: 1 }], cap: 1000, roundingUnit: "item" },
    },
  },
  {
    // 利用者が自分で倍率を決めるキャンペーン。sharedKey がないので何度でも足せる。
    id: "custom-rate",
    name: "自由な倍率",
    occurrence: "user-period",
    benefit: {
      id: "dfdc5dd1-cbde-40a4-b8cd-61b2542cd5ab",
      kind: "rate-bonus",
      category: "campaign",
      label: "自由な倍率",
      enabled: false,
      amountBasis: "tax-excluded",
      capScope: "plan",
      conditions: {},
      params: { rate: 1, roundingUnit: "item" },
    },
  },
];
