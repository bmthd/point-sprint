import type * as v from "valibot";

export type EligibleItem = { lineItemId: string; orderId: string; amount: number };
export type RoundingUnit = "item" | "order";

export interface BenefitKindDef<K extends string, P extends { cap?: number }> {
  kind: K;
  paramsSchema: v.GenericSchema<unknown, P>;
  defaultParams: P;
  onlyReceivingChannels: boolean;
  rawPoints(input: { params: P; items: EligibleItem[]; shopCount: number }): Map<string, number>;
}
