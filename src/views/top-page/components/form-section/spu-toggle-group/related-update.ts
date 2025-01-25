import { SpuID } from "@/views/top-page/const/spu";

/**
 * SPUの関連項目の更新する際の関連性を定義
 * 例: card_premiumがtrueの場合、card_commonとcardはtrue、card_premiumはfalseになる
 */
export const relatedUpdateMap = {
  card_premium: { true: { card_common: true, card: false }, false: { card_common: false } },
  card: { true: { card_common: true, card_premium: false }, false: { card_common: false } },
  card_common: { true: { card: true }, false: { card: false, card_premium: false } },
  bank: { true: { bank_salary: false } },
  bank_salary: { true: { bank: false } },
} as const satisfies Partial<
  Record<SpuID, Partial<Record<`${boolean}`, Partial<Record<SpuID, boolean>>>>>
>;

export const hasRelatedUpdate = (spuId: SpuID): spuId is keyof typeof relatedUpdateMap =>
  Object.hasOwn(relatedUpdateMap, spuId);

export const hasUpdates = (
  related: (typeof relatedUpdateMap)[keyof typeof relatedUpdateMap],
  state: `${boolean}`,
): state is keyof typeof related => Object.hasOwn(related, state);
