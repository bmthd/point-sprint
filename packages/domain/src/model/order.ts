import * as v from "valibot";
import { IdSchema, IsoDateSchema, OrderTagSchema } from "./common";

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

export const OrderSchema = v.object({
  id: IdSchema,
  shopId: IdSchema,
  date: IsoDateSchema,
  lineItems: v.pipe(v.array(LineItemSchema), v.minLength(1)),
  onHold: v.optional(v.boolean(), false),
  tags: v.optional(v.array(OrderTagSchema), []),
});
export type Order = v.InferOutput<typeof OrderSchema>;
