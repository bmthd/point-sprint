import {
  type CalculationResult,
  CURRENT_SCHEMA_VERSION,
  type Plan,
  type Profile,
  type Shop,
  type SpuMonth,
  standardSpu,
} from "@workspaces/domain";
import { siteUrl } from "#/site-url.ts";
import { tokyoToday } from "#/ui/dates.ts";

const about = [
  `楽天市場のポイント計算アプリ「ポイントスプリント」（${siteUrl}）から書き出したデータです。`,
  "plans は買い物の計画で、orders が注文、benefits がプランに入れたキャンペーンです。注文の shopId は shops の id を指します。",
  "spuMonths はアカウントと月ごとに達成した SPU で、enabledIds は spuCatalog の id を指します。",
  "calculations はプランごとの計算で、benefits は SPU を組み込んだ計算用の特典、result はアプリが計算した獲得ポイントです。result の benefitId や source は benefits の id を、lineItemId は注文の lineItems の id を指します。",
  "plans の onHold が true のプランは保留中で、ほかのプランの上限や SPU に数えません。その calculations の result は、保留でないプランに重ねて試算した結果です。",
  "このファイルの形はアプリの版（schemaVersion）によって変わります。",
].join("\n");

/**
 * Every stored row, as it is stored, with what an AI needs to read it: the SPU the months' ids
 * name, and each plan's benefits and points as the app calculates them. Nothing reads it back.
 */
export function exportData(input: {
  plans: Plan[];
  shops: Shop[];
  profile: Profile;
  spuMonths: SpuMonth[];
  /** The plans as they are calculated, with the SPU among their benefits. */
  calculatedPlans: Plan[];
  results: ReadonlyMap<string, CalculationResult>;
  exportedAt: Date;
}) {
  return {
    about,
    exportedAt: input.exportedAt.toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: input.profile,
    shops: input.shops,
    spuMonths: input.spuMonths,
    plans: input.plans,
    spuCatalog: standardSpu,
    calculations: input.calculatedPlans.map((plan) => ({
      planId: plan.id,
      benefits: plan.benefits,
      result: input.results.get(plan.id),
    })),
  };
}

/** `point-sprint-2026-11-18.json`, dated in Japan. */
export function exportFileName(exportedAt: Date) {
  return `point-sprint-${tokyoToday(exportedAt)}.json`;
}
