import * as v from "valibot";
import { ProfileSchema } from "../model/plan";
import { ShopSchema } from "../model/shop";
import { SpuMonthSchema } from "../model/spu-month";
import { OrderRowSchema, PlanRowSchema } from "../model/stored-plan";
import type { StoreName } from "../migrations/runner";

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
export const orderRowId = (planId: string, orderId: string) => `${planId}:${orderId}`;

/** One key per row across every kind. */
export const syncKey = (kind: SyncKind, id: string) => `${kind}:${id}`;

/**
 * Whether a row from another device replaces the one here. Only a later `updatedAt` does: on a tie
 * both devices keep what they have, which is the same row when they made it from the same change.
 */
export const isNewer = (
  incoming: { updatedAt: string },
  current: { updatedAt: string } | undefined,
): boolean => current === undefined || incoming.updatedAt > current.updatedAt;
