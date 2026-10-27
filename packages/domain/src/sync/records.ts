import * as v from "valibot";
import { ProfileSchema } from "../model/plan";
import { ShopSchema } from "../model/shop";
import { SpuMonthSchema } from "../model/spu-month";
import { OrderRowSchema, PlanRowSchema } from "../model/stored-plan";
import type { StoreName } from "../migrations/runner";
import { stableJson } from "../model/stored-plan";

// What two devices send each other: one row of a store, or the mark that it was removed. The later
// `updatedAt` wins row by row.

export const SYNC_KINDS = ["plan", "order", "shop", "profile", "spuMonth"] as const;
export type SyncKind = (typeof SYNC_KINDS)[number];

/** The store each kind of row is kept in. */
export const syncStores = {
  plan: "plans",
  order: "orders",
  shop: "shops",
  profile: "profile",
  spuMonth: "spuMonths",
} as const satisfies Record<SyncKind, StoreName>;

export const syncSchemas = {
  plan: PlanRowSchema,
  order: OrderRowSchema,
  shop: ShopSchema,
  profile: ProfileSchema,
  spuMonth: SpuMonthSchema,
} as const;

/** The id of the profile, which is one row with no id of its own. */
export const PROFILE_ID = "profile";

export type SyncRow =
  | { kind: SyncKind; id: string; updatedAt: string; deleted: false; value: unknown }
  | { kind: SyncKind; id: string; updatedAt: string; deleted: true };

export const SyncRowSchema = v.variant("deleted", [
  v.object({
    kind: v.picklist(SYNC_KINDS),
    id: v.string(),
    updatedAt: v.string(),
    deleted: v.literal(false),
    value: v.unknown(),
  }),
  v.object({
    kind: v.picklist(SYNC_KINDS),
    id: v.string(),
    updatedAt: v.string(),
    deleted: v.literal(true),
  }),
]);

/**
 * The id of an order's row: orders are told apart within their plan, so the same order id in two
 * plans is two rows.
 */
export function orderRowId(planId: string, orderId: string) {
  return `${planId}:${orderId}`;
}

/** One key per row across every kind. */
export function syncKey(kind: SyncKind, id: string) {
  return `${kind}:${id}`;
}

/**
 * Whether a row from the server replaces the one here: a later `updatedAt` does. On the same
 * `updatedAt`, a different row does too: the server keeps the last of two rows of the same time
 * (`sync-records.ts`), and taking what it sends makes every device end on that one.
 */
export function wins(incoming: SyncRow, current: SyncRow | undefined): boolean {
  if (current === undefined || incoming.updatedAt > current.updatedAt) return true;
  if (incoming.updatedAt < current.updatedAt) return false;
  const content = (row: SyncRow) => stableJson(row.deleted ? null : row.value);
  return content(incoming) !== content(current);
}
