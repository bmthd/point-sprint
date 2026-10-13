import * as v from "valibot";
import { ChannelIdSchema, IdSchema, ShopTagSchema, TimestampSchema } from "./common";

export const ShopSchema = v.object({
  id: IdSchema,
  channel: ChannelIdSchema,
  shopCode: v.optional(v.string()),
  name: v.pipe(v.string(), v.minLength(1)),
  tags: v.optional(v.array(ShopTagSchema), []),
  updatedAt: TimestampSchema,
});
export type Shop = v.InferOutput<typeof ShopSchema>;
