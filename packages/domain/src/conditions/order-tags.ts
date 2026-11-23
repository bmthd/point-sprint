import type { Benefit } from "#/model/benefit.ts";
import type { OrderTag } from "#/model/common.ts";

/** 注文タグを条件に持つキャンペーンがあるか。無効なものも含む。 */
export function hasOrderTagCampaign(benefits: readonly Benefit[], tag: OrderTag) {
  return benefits.some((benefit) => benefit.conditions.orderTags?.includes(tag));
}
