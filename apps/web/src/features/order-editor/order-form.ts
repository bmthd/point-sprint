import {
  type Benefit,
  ChannelIdSchema,
  type Order,
  OrderSchema,
  type Shop,
  matchesConditions,
} from "@workspaces/domain";
import * as v from "valibot";
import type { ShopChange } from "../../state/mutations";
import { tokyoToday } from "../plan-list/dates";
import {
  AmountSchema,
  DateSchema,
  DiscountSchema,
  NEW_SHOP,
  QuantitySchema,
  ShopRateSchema,
  TAX_RATES,
  shopToSave,
  taxRateValue,
} from "../plan-home/order-fields";

const ItemSchema = v.pipe(
  v.object({
    /** Empty for an item that is not saved yet. */
    id: v.string(),
    name: v.pipe(v.string(), v.trim()),
    unitPrice: AmountSchema,
    quantity: QuantitySchema,
    taxRate: v.picklist(TAX_RATES),
    discount: DiscountSchema,
    shopPointRate: ShopRateSchema,
  }),
  v.forward(
    v.partialCheck(
      [["unitPrice"], ["quantity"], ["discount"]],
      (item) => item.discount <= item.unitPrice * item.quantity,
      "クーポン値引額が金額より大きくなっています",
    ),
    ["discount"],
  ),
);

const UrlSchema = v.pipe(v.string(), v.url());

/** The whole order as the editor's fields hold it. Only a valid form is saved. */
export const OrderFormSchema = v.pipe(
  v.object({
    url: v.pipe(v.string(), v.trim()),
    shop: v.pipe(v.string(), v.nonEmpty("ショップを選んでください")),
    newShopName: v.pipe(v.string(), v.trim()),
    channel: ChannelIdSchema,
    shopCode: v.string(),
    date: DateSchema,
    is39: v.boolean(),
    repeat: v.boolean(),
    onHold: v.boolean(),
    items: v.pipe(v.array(ItemSchema), v.minLength(1)),
  }),
  v.forward(
    v.partialCheck(
      [["shop"], ["newShopName"]],
      (values) => values.shop !== NEW_SHOP || values.newShopName !== "",
      "新しいショップの名前を入れてください",
    ),
    ["newShopName"],
  ),
);

export type OrderFormInput = v.InferInput<typeof OrderFormSchema>;
export type OrderFormOutput = v.InferOutput<typeof OrderFormSchema>;
export type ItemInput = OrderFormInput["items"][number];

export const emptyItem = (): ItemInput => ({
  id: "",
  name: "",
  unitPrice: "",
  quantity: "1",
  taxRate: "0.1",
  discount: "",
  shopPointRate: "",
});

export const emptyInput = (): OrderFormInput => ({
  url: "",
  shop: "",
  newShopName: "",
  channel: "rakuten-ichiba",
  shopCode: "",
  date: tokyoToday(new Date()),
  is39: false,
  repeat: false,
  onHold: false,
  items: [emptyItem()],
});

/** The editor's fields for an order that is already saved. */
export function inputOf(order: Order, shops: Shop[]): OrderFormInput {
  const shop = shops.find((other) => other.id === order.shopId);
  return {
    ...emptyInput(),
    url: order.lineItems[0]?.url ?? "",
    shop: order.shopId,
    date: order.date,
    is39: shop?.tags.includes("39shop") ?? false,
    repeat: order.tags.includes("repeat"),
    onHold: order.onHold,
    items: order.lineItems.map((item) => ({
      id: item.id,
      name: item.name,
      unitPrice: String(item.unitPrice),
      quantity: String(item.quantity),
      taxRate: taxRateValue(item.taxRate),
      discount: item.discount ? String(item.discount) : "",
      shopPointRate: item.shopPointRate === undefined ? "" : String(item.shopPointRate),
    })),
  };
}

export type OrderDraft = {
  order: Order;
  shop: Shop | undefined;
  shopChange: ShopChange | undefined;
};

/**
 * The order (and the shop to save first) that a valid form describes. An edited order keeps its
 * id, and its items keep their ids and what the form does not show (item code). The URL field is
 * stored on the first item when it is a URL.
 */
export function draftOf(
  output: OrderFormOutput,
  shops: Shop[],
  original: Order | undefined,
): OrderDraft | undefined {
  const { shopId, shop, change: shopChange } = shopToSave(output, shops);
  const items = new Map(original?.lineItems.map((item) => [item.id, item]));
  const parsed = v.safeParse(OrderSchema, {
    ...original,
    id: original?.id ?? crypto.randomUUID(),
    shopId,
    date: output.date,
    onHold: output.onHold,
    tags: output.repeat ? ["repeat"] : [],
    lineItems: output.items.map(({ id, shopPointRate, ...item }, index) => {
      const { shopPointRate: _rate, url: keptUrl, ...kept } = items.get(id) ?? {};
      // The URL field belongs to the first item; the others keep the URL they had.
      const url = index === 0 ? (v.is(UrlSchema, output.url) ? output.url : undefined) : keptUrl;
      return {
        ...kept,
        ...item,
        id: id || crypto.randomUUID(),
        taxRate: Number(item.taxRate),
        ...(shopPointRate === undefined ? {} : { shopPointRate }),
        ...(url === undefined ? {} : { url }),
      };
    }),
  });
  return parsed.success ? { order: parsed.output, shop, shopChange } : undefined;
}

/** The draft of a form's current input, or `undefined` while it is not valid. */
export function draftOfInput(
  input: unknown,
  shops: Shop[],
  original: Order | undefined,
): OrderDraft | undefined {
  const parsed = v.safeParse(OrderFormSchema, input);
  return parsed.success ? draftOf(parsed.output, shops, original) : undefined;
}

export const rateOf = (benefit: Benefit) =>
  benefit.kind === "shop-around" ? 0 : benefit.params.rate;

/** The sum of the rates of the plan's campaigns that need a shop or order tag (「+1」). */
export function tagBonus(benefits: Benefit[], tag: { shop?: "39shop"; order?: "repeat" }) {
  return benefits
    .filter(
      (benefit) =>
        benefit.enabled &&
        ((tag.shop && benefit.conditions.shopTags?.includes(tag.shop)) ||
          (tag.order && benefit.conditions.orderTags?.includes(tag.order))),
    )
    .reduce((sum, benefit) => sum + rateOf(benefit), 0);
}

/** The plan's campaigns that apply by the order date alone (「日付で自動」). */
export function dateCampaigns(benefits: Benefit[], date: string) {
  return benefits.filter(
    (benefit) =>
      benefit.enabled &&
      benefit.kind === "rate-bonus" &&
      benefit.category === "campaign" &&
      benefit.conditions.dateRule !== undefined &&
      matchesConditions(
        { dateRule: benefit.conditions.dateRule },
        {
          channel: null,
          shopTags: null,
          shopId: "",
          date,
          orderTaxIncluded: 0,
          orderTags: [],
        },
      ),
  );
}
