// SPU（スーパーポイントアッププログラム）の標準定義。
// 出典: https://event.rakuten.co.jp/campaign/point-up/everyday/point/
// 確認日: 2026-10-04（ページの表記は「ポイント最大18.5倍」）
//
// 各項目の倍率と月間獲得上限ポイント数は、ページの「特典N」と各特典のルール
// （「▼月間獲得上限ポイント数」）から写した。
// ページの「■対象サービス」は楽天市場での通常購入・定期購入・頒布会・楽天ブックス・楽天Kobo・
// Rakuten Fashion・楽天24エクスプレスなので、どの項目も channels を楽天市場と楽天ブックスに限る
// （ラクマでの購入は対象外）。
// 各項目の達成条件（「月に一度以上3,000円以上」など、楽天市場の外での利用）は
// conditions で表せないため、ユーザーが自分の達成状況に合わせて enabled を切り替える。
// 旧サイトになかった新しい4サービスのアイコンは、上記の公式SPUページが配信する画像を
// 2026-10-05に取得した（楽天でんき、楽天Kドリームス、楽天ラクマ、楽天ポイントカード）。
import type { Benefit } from "../model/benefit";
import type { ChannelId } from "../model/common";

type AmountBasis = Benefit["amountBasis"];
type CapScope = Benefit["capScope"];

const SPU_CHANNELS: ChannelId[] = ["rakuten-ichiba", "rakuten-books"];

function spu(
  id: string,
  label: string,
  imagePath: string | undefined,
  params: {
    rate: number;
    cap?: number;
    roundingUnit?: "item" | "order";
    amountBasis?: AmountBasis;
    capScope?: CapScope;
    category?: "base" | "spu";
    exclusiveGroup?: string;
  },
  enabled = false,
): Benefit {
  const { rate, cap, roundingUnit = "item", amountBasis = "tax-excluded" } = params;
  // 上限のある項目は「月間獲得上限ポイント数」なので、既定でカレンダー月ごとに数える。
  const capScope = params.capScope ?? (cap === undefined ? "plan" : "month");
  return {
    id,
    kind: "rate-bonus",
    // 通常ポイントと楽天カード通常分は内訳で「通常」に数えるため base にする。
    category: params.category ?? "spu",
    label,
    ...(imagePath === undefined ? {} : { imagePath }),
    enabled,
    amountBasis,
    capScope,
    conditions: { channels: [...SPU_CHANNELS] },
    ...(params.exclusiveGroup === undefined ? {} : { exclusiveGroup: params.exclusiveGroup }),
    params: cap === undefined ? { rate, roundingUnit } : { rate, cap, roundingUnit },
  };
}

export const standardSpu: Benefit[] = [
  // 「お買い物通常ポイント：1倍（楽天市場から進呈）」。上限の記載なし。
  spu(
    "c69441cb-ac51-4cf9-8ebd-a909a093907e",
    "通常ポイント",
    "/img/spu/service_normal.webp",
    { rate: 1, category: "base" },
    true,
  ),
  // 「1-1．楽天カード利用通常ポイント：+1倍」「▼月間獲得上限ポイント数 なし」。
  // カード本体の還元（楽天カードから付与）で、付与対象は消費税・送料・ラッピング料を含む金額。
  // 計算エンジンは税込額を使うが、送料・ラッピング料は表せない。
  spu(
    "9527dde1-c708-44fa-b2cf-5b7b35e0f3d1",
    "楽天カード通常分（カード本体の還元）",
    "/img/spu/service_card.webp",
    {
      rate: 1,
      amountBasis: "tax-included",
      roundingUnit: "order",
      capScope: "plan",
      category: "base",
    },
  ),
  // 「1-2．楽天カード利用特典ポイント：+1倍」。SPU の特典として楽天市場から付与される。
  // 上限は「その他の対象カード：1,000ポイント」。
  // 楽天プレミアムカード等は 5,000ポイント（ユーザーが cap を編集する）。
  spu(
    "864f3f89-dacc-4313-a528-dac222c383cc",
    "楽天カード特典分（SPU）",
    "/img/spu/service_card.webp",
    {
      rate: 1,
      amountBasis: "tax-excluded",
      cap: 1000,
      roundingUnit: "order",
      capScope: "month",
      exclusiveGroup: "rakuten-card",
    },
  ),
  // 楽天プレミアムカード・楽天ブラックカード・楽天ビジネスカードの特典分。上限は月5,000ポイント
  // （上の特典分の「その他の対象カード」とは別の上限）。出典は上と同じ SPU のページ。
  // 上限が違うので sharedKey は付けず、各項目が自分の id で上限を数える。
  // 楽天カード特典分と同じ exclusiveGroup で、どちらか一方だけ有効にできる。
  spu(
    "b3acca83-be7b-4c8a-9637-7706296679d4",
    "楽天プレミアムカード（特典分）",
    "/img/spu/service_card_premium.webp",
    {
      rate: 1,
      amountBasis: "tax-excluded",
      cap: 5000,
      roundingUnit: "order",
      capScope: "month",
      exclusiveGroup: "rakuten-card",
    },
    false,
  ),
  // 「特典2 楽天モバイルのご契約者はポイント+4倍」「月間獲得上限ポイント数 2,000ポイント」。
  spu("ca794fa7-4a85-43c6-ab34-e06feb115c5d", "楽天モバイル", "/img/spu/service_mobile_v2.webp", {
    rate: 4,
    cap: 2000,
  }),
  // 「特典3 楽天ブックスで…3,000円以上…ポイント+0.5倍」「500ポイント」。
  // 付与対象は「当月の楽天市場でのお買い物」で、楽天ブックスでの購入に限らない。
  spu("c6a1511e-c5e8-4c68-958a-4b1d5dd3ea42", "楽天ブックス", "/img/spu/service_books.webp", {
    rate: 0.5,
    cap: 500,
  }),
  // 「特典4 楽天Koboで…3,000円以上…ポイント+0.5倍」「500ポイント」。
  spu("e86e12fd-173a-48a4-995d-2408c4b1d4c2", "楽天Kobo", "/img/spu/service_kobo.webp", {
    rate: 0.5,
    cap: 500,
  }),
  // 「特典5 Rakuten FashionアプリでRakuten Fashion商品を月1回1注文5,000円以上…ポイント+0.5倍」「1,000ポイント」。
  spu(
    "8cc70769-9599-461e-90f5-6e03ed5e6e7b",
    "Rakuten Fashionアプリ",
    "/img/spu/service_rba_app.webp",
    { rate: 0.5, cap: 1000 },
  ),
  // 「特典6 楽天トラベル月1回5,000円（税込）以上…ポイント＋1倍」「1,000ポイント」。
  spu("ebdcc366-2dd3-48e3-b64b-1a9157698b19", "楽天トラベル", "/img/spu/service_travel.webp", {
    rate: 1,
    cap: 1000,
  }),
  // 「特典7 楽天ビューティ月1回3,000円（税込）以上のネット予約＆施術完了でポイント＋0.5倍」「500ポイント」。
  spu("4d4aff27-3536-4162-99a2-c0dd05900df6", "楽天ビューティ", "/img/spu/service_beauty.webp", {
    rate: 0.5,
    cap: 500,
  }),
  // 「特典8 楽天銀行で楽天カードの引落をするとポイント最大+0.5倍」「1,000ポイント」。
  // 条件1〜3で+0.3倍、条件1〜5（給与・賞与・年金の受取とハッピープログラムのエントリーを含む）で+0.5倍。
  // ここでは最大の+0.5倍を置く。付与対象は楽天カードでの購入分だが、支払方法は conditions で表せない。
  spu(
    "3a7c47bd-3404-4dcb-9569-54989e63f077",
    "楽天銀行（楽天カード引落）",
    "/img/spu/service_bank.webp",
    {
      rate: 0.5,
      cap: 1000,
    },
  ),
  // 「9-1 当月合計30,000円以上のポイント投資（投資信託）でポイント+0.5倍」「2,000ポイント」。
  spu(
    "783251db-1b47-4c78-aa29-20038fb53dac",
    "楽天証券（投資信託）",
    "/img/spu/service_securities.webp",
    { rate: 0.5, cap: 2000 },
  ),
  // 「9-2 当月合計30,000円以上のポイント投資（米国株式 円貨決済）でポイント+0.5倍」「2,000ポイント」。
  spu(
    "a0a88686-e44e-4e28-b755-96babb1aa00d",
    "楽天証券（米国株式）",
    "/img/spu/service_securities_us.webp",
    { rate: 0.5, cap: 2000 },
  ),
  // 「特典10 Rakuten Pashaのアイテムクーポンにて当月申請分で500ポイント以上獲得すると、ポイント+0.5倍」「1,000ポイント」。
  spu("6569a41a-61a7-47c9-a287-926afe628f66", "Rakuten Pasha", "/img/spu/service_pasha.webp", {
    rate: 0.5,
    cap: 1000,
  }),
  // 「特典11 Rakuten Turboまたは楽天ひかりのご契約者はポイント+2倍」「1,000ポイント」。
  spu(
    "135ea1c8-2125-4571-9561-e606edf3b9c3",
    "Rakuten Turbo／楽天ひかり",
    "/img/spu/service_turbo_hikari.webp",
    { rate: 2, cap: 1000 },
  ),
  // 「特典12 楽天モバイルキャリア決済（Androidのみ）を月に合計2,000円（税込）以上ご利用でポイント＋2倍」「1,000ポイント」。
  spu(
    "ece41157-00dd-4626-a7f9-24715d505645",
    "楽天モバイルキャリア決済",
    "/img/spu/service_mobile_carrier_billing.webp",
    { rate: 2, cap: 1000 },
  ),
  // 「特典13 楽天ウォレットの暗号資産現物取引で月に合計30,000円以上購入…ポイント+0.5倍」「1,000ポイント」。
  spu(
    "92d1dd04-2120-4fab-98a6-a3a72c81c513",
    "楽天ウォレット",
    "/img/spu/service_wallet_red.webp",
    {
      rate: 0.5,
      cap: 1000,
    },
  ),
  // 「特典14 楽天でんきの前月のご利用金額が5,500円（税込）以上…ポイント+0.5倍」「1,000ポイント」。
  spu("7cb3966c-5f5f-42d3-89ad-270a6a77cad8", "楽天でんき", "/img/spu/service_denki.webp", {
    rate: 0.5,
    cap: 1000,
  }),
  // 「特典15 楽天Kドリームスで月合計10,000円以上（ワイドを除く）…ポイント＋0.5倍」「2,000ポイント」。
  spu("ac2540d6-b9ad-45d1-9536-552a15213f06", "楽天Kドリームス", "/img/spu/service_kdreams.webp", {
    rate: 0.5,
    cap: 2000,
  }),
  // 「特典16 楽天ラクマで月間合計2,000円以上の販売&発送通知完了…ポイント+0.5倍」「500ポイント」。
  spu(
    "70e5b7c4-87e2-42e6-a650-352b6650784e",
    "楽天ラクマ（販売）",
    "/img/spu/service_rakuma.webp",
    {
      rate: 0.5,
      cap: 500,
    },
  ),
  // 「特典17 ファミリーマートで楽天ポイントカードを提示して、月間3,000円（税込）以上ご購入でポイント+0.5倍」「500ポイント」。
  spu(
    "6f0d44d9-6c90-4d4d-801d-9e06bc4ae76f",
    "楽天ポイントカード（ファミリーマート）",
    "/img/spu/service_pointcard_familymart.webp",
    {
      rate: 0.5,
      cap: 500,
    },
  ),
];
