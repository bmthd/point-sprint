import * as v from "valibot";
import { ChannelIdSchema, IdSchema, IsoDateSchema, OrderTagSchema, ShopTagSchema } from "./common";
import type { Shop } from "./shop";

export const LineItemSchema = v.pipe(
  v.object({
    id: IdSchema,
    name: v.string(),
    unitPrice: v.pipe(v.number(), v.integer(), v.minValue(0)),
    quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
    taxRate: v.picklist([0.1, 0.08, 0]),
    discount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
    shopPointRate: v.optional(v.pipe(v.number(), v.minValue(1))),
    itemCode: v.optional(v.string()),
    url: v.optional(v.pipe(v.string(), v.url())),
  }),
  v.check(
    (item) => item.discount <= item.unitPrice * item.quantity,
    "discount exceeds line amount",
  ),
);
export type LineItem = v.InferOutput<typeof LineItemSchema>;

const commonEntries = {
  id: IdSchema,
  date: IsoDateSchema,
  lineItems: v.pipe(v.array(LineItemSchema), v.minLength(1)),
  onHold: v.optional(v.boolean(), false),
  tags: v.optional(v.array(OrderTagSchema), []),
};

export const OrderSchema = v.union([
  v.object({
    ...commonEntries,
    shopId: IdSchema,
    channel: v.exactOptional(v.never()),
    shopTags: v.exactOptional(v.never()),
  }),
  v.object({
    ...commonEntries,
    shopId: v.exactOptional(v.never()),
    channel: ChannelIdSchema,
    shopTags: v.array(ShopTagSchema),
  }),
]);
export type Order = v.InferOutput<typeof OrderSchema>;

export const hasShop = (order: Order): order is Extract<Order, { shopId: string }> =>
  order.shopId !== undefined;

export function orderShopContext(
  order: Order,
  shop: Shop | undefined,
): {
  channel: Shop["channel"] | null;
  shopTags: Shop["tags"] | null;
} {
  return hasShop(order)
    ? { channel: shop?.channel ?? null, shopTags: shop?.tags ?? null }
    : { channel: order.channel, shopTags: order.shopTags };
}
