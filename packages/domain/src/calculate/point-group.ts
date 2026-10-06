import type { Benefit } from "../model/benefit";

/** The four groups of the breakdown on screen (spec §2 `Benefit.category`). */
export type PointGroup = "base" | "spu" | "marathon" | "campaign";

export const POINT_GROUPS: readonly PointGroup[] = ["base", "spu", "marathon", "campaign"];

export function pointGroupOf(source: Benefit | "shop-rate"): PointGroup {
  if (source === "shop-rate") return "campaign";
  if (source.kind === "shop-around") return "marathon";
  return source.category;
}
