import * as v from "valibot";
import { ChannelIdSchema, IdSchema, ShopTagSchema } from "../model/common";
import type { Shop } from "../model/shop";
import type { Migration } from "./runner";

const LegacyPlanSchema = v.looseObject({
  orders: v.array(
    v.looseObject({
      shopId: v.optional(IdSchema),
      channel: v.optional(ChannelIdSchema),
      shopTags: v.optional(v.array(ShopTagSchema)),
    }),
  ),
});

export function migrateOrderPurchases(row: unknown, shops: Shop[] = []): unknown {
  const parsed = v.safeParse(LegacyPlanSchema, row);
  if (!parsed.success) return row;
  const unnamed = new Map(
    shops.filter((shop) => shop.name === "" && !shop.shopCode).map((shop) => [shop.id, shop]),
  );
  return {
    ...parsed.output,
    orders: parsed.output.orders.map(({ shopId, channel, shopTags, ...common }) => {
      const shop = shopId === undefined ? undefined : unnamed.get(shopId);
      return shopId !== undefined && !shop
        ? { ...common, shopId }
        : {
            ...common,
            channel: shop?.channel ?? channel ?? "rakuten-ichiba",
            shopTags: shop?.tags ?? shopTags ?? [],
          };
    }),
  };
}

export const orderPurchasesMigration: Migration = {
  to: 4,
  stores: { plans: migrateOrderPurchases },
};
