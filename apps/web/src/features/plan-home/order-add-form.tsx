import {
  ChannelIdSchema,
  type Order,
  OrderSchema,
  type Plan,
  type Shop,
  calculateAll,
  parseUrl,
} from "@workspaces/domain";
import { Box, Button, Input, List, NativeSelect, Text, styled } from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { type FormEvent, type KeyboardEvent, useId, useMemo, useRef, useState } from "react";
import * as v from "valibot";
import { calculationAtom } from "../../state/derived";
import { type ShopChange, saveShopAtom } from "../../state/mutations";
import { addOrderAtom } from "../../state/order-ops";
import { plansAtom, shopsAtom } from "../../state/queries";
import { AutofillStatusText, useItemAutofill } from "../item-autofill/item-autofill";
import { tokyoToday } from "../plan-list/dates";
import { PlusIcon } from "./icons";
import {
  AmountSchema,
  DateSchema,
  Field,
  NEW_SHOP,
  type ShopFromUrl,
  ShopRateSchema,
  TAX_RATES,
  TaxRateOptions,
  type TaxRateValue,
  ToggleChip,
  fieldGrid,
  fieldsFromItem,
  shopFromItem,
  shopFromUrl,
  shopToSave,
  useSortedShops,
} from "./order-fields";
import { orderSaveFailedAtom, pointsText } from "./order-shared";

const AddFormSchema = v.pipe(
  v.object({
    url: v.pipe(v.string(), v.trim()),
    shop: v.pipe(v.string(), v.nonEmpty("ショップを選んでください")),
    newShopName: v.pipe(v.string(), v.trim()),
    channel: ChannelIdSchema,
    shopCode: v.string(),
    date: DateSchema,
    name: v.pipe(v.string(), v.trim()),
    amount: AmountSchema,
    taxRate: v.picklist(TAX_RATES),
    shopPointRate: ShopRateSchema,
    is39: v.boolean(),
    repeat: v.boolean(),
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

const UrlSchema = v.pipe(v.string(), v.url());

type Values = v.InferInput<typeof AddFormSchema>;
type Errors = Partial<Record<keyof Values, [string, ...string[]]>>;

const emptyValues = (): Values => ({
  url: "",
  shop: "",
  newShopName: "",
  channel: "rakuten-ichiba",
  shopCode: "",
  date: tokyoToday(new Date()),
  name: "",
  amount: "",
  taxRate: "0.1",
  shopPointRate: "",
  is39: false,
  repeat: false,
});

type Draft =
  | { ok: true; order: Order; shop: Shop | undefined; shopChange: ShopChange | undefined }
  | { ok: false; errors: Errors };

/**
 * The order the form describes, and the shop to save with it: a new shop, or the chosen shop
 * when its 39ショップ mark changes.
 */
function draftOf(values: Values, shops: Shop[]): Draft {
  const parsed = v.safeParse(AddFormSchema, values);
  if (!parsed.success) {
    return { ok: false, errors: v.flatten<typeof AddFormSchema>(parsed.issues).nested ?? {} };
  }
  const input = parsed.output;
  const { shopId, shop, change: shopChange } = shopToSave(input, shops);

  const order = v.safeParse(OrderSchema, {
    id: crypto.randomUUID(),
    shopId,
    date: input.date,
    lineItems: [
      {
        id: crypto.randomUUID(),
        name: input.name,
        unitPrice: input.amount,
        quantity: 1,
        taxRate: Number(input.taxRate),
        ...(input.shopPointRate === undefined ? {} : { shopPointRate: input.shopPointRate }),
        ...(v.is(UrlSchema, input.url) ? { url: input.url } : {}),
      },
    ],
    onHold: false,
    tags: input.repeat ? ["repeat"] : [],
  });
  if (!order.success) return { ok: false, errors: { amount: ["この内容では追加できません"] } };
  return { ok: true, order: order.output, shop, shopChange };
}

const sumOfTotals = (results: Map<string, { total: number }>) =>
  [...results.values()].reduce((sum, result) => sum + result.total, 0);

/** 「この注文で（5店舗目） 約 +120P」 for a valid draft. */
function Preview({ plan, draft }: { plan: Plan; draft: Draft }) {
  const plans = useAtomValue(plansAtom);
  const shops = useAtomValue(shopsAtom);
  const before = useAtomValue(calculationAtom);
  const preview = useMemo(() => {
    if (!draft.ok) return undefined;
    const withShop = draft.shop
      ? [...shops.filter((shop) => shop.id !== draft.shop?.id), draft.shop]
      : shops;
    const withOrder = plans.map((other) =>
      other.id === plan.id ? { ...other, orders: [...other.orders, draft.order] } : other,
    );
    const after = calculateAll(withOrder, withShop);
    const shopCountBefore = before.get(plan.id)?.shopCount ?? 0;
    const shopCountAfter = after.get(plan.id)?.shopCount ?? 0;
    return {
      points: sumOfTotals(after) - sumOfTotals(before),
      shop: shopCountAfter > shopCountBefore ? shopCountAfter : undefined,
    };
  }, [draft, plans, shops, before, plan.id]);

  return (
    <Text
      as="span"
      flex="1"
      minW="200px"
      fontSize="sm"
      fontVariantNumeric="tabular-nums"
      aria-live="polite"
      data-preview
    >
      {preview ? (
        <>
          この注文で{preview.shop ? `（${preview.shop}店舗目）` : ""}{" "}
          <Text as="b" color="primary.fg">
            約 +{pointsText(preview.points)}
          </Text>
        </>
      ) : (
        <Text as="span" color="fg.muted">
          ショップと金額を入れると、増えるポイントの目安が出ます
        </Text>
      )}
    </Text>
  );
}

/**
 * 「＋ 注文を追加」 at the end of the desktop list. Enter in any field adds the order when it is
 * valid, then empties the form and puts the focus back on its first field.
 */
export function OrderAddForm({ plan }: { plan: Plan }) {
  const shops = useAtomValue(shopsAtom);
  const saveShop = useAtomValue(saveShopAtom);
  const addOrder = useSetAtom(addOrderAtom);
  const setFailed = useSetAtom(orderSaveFailedAtom);
  const saving = useRef(false);
  const [open, setOpen] = useState(plan.orders.length === 0);
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState<Errors>({});
  const firstField = useRef<HTMLInputElement>(null);
  const formId = useId();
  const sortedShops = useSortedShops(shops);
  const draft = useMemo(() => draftOf(values, shops), [values, shops]);

  const set = (change: Partial<Values>) => setValues((current) => ({ ...current, ...change }));
  const error = (key: keyof Values) => errors[key]?.[0];

  const chooseShop = (shopId: string) => {
    const shop = shops.find((other) => other.id === shopId);
    set({ shop: shopId, is39: shop?.tags.includes("39shop") ?? false });
  };

  const shopValues = (found: ShopFromUrl): Partial<Values> =>
    found.kind === "registered"
      ? { shop: found.shop.id, is39: found.shop.tags.includes("39shop") }
      : {
          shop: NEW_SHOP,
          channel: found.channel,
          shopCode: found.shopCode,
          newShopName: found.name,
          is39: false,
        };

  // A found item fills in its name, price, shop and shop rate, which can then be edited.
  const autofill = useItemAutofill((item) => {
    const { name, unitPrice, shopPointRate } = fieldsFromItem(item);
    set({
      ...shopValues(shopFromItem(item, shops)),
      name,
      shopPointRate,
      ...(unitPrice === undefined ? {} : { amount: unitPrice }),
    });
  });

  // The shop of the URL is chosen at once, and stays when the item cannot be looked up.
  const onUrl = (url: string) => {
    const found = shopFromUrl(url, shops);
    set({ url, ...(found ? shopValues(found) : {}) });
    autofill.onUrl(url);
  };

  const submit = async () => {
    if (!draft.ok) {
      setErrors(draft.errors);
      return;
    }
    if (saving.current) return;
    saving.current = true;
    const { order, shopChange } = draft;
    setFailed(false);
    try {
      if (shopChange) await saveShop.mutateAsync(shopChange);
      await addOrder({ planId: plan.id, order });
      autofill.reset();
      setValues(emptyValues());
      setErrors({});
      firstField.current?.focus();
    } catch {
      // The typed order stays in the form so it can be added again.
      setFailed(true);
    } finally {
      saving.current = false;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    void submit();
  };

  const urlUnknown = values.url.trim() !== "" && parseUrl(values.url.trim()) === null;

  return (
    <List.Item borderTopWidth={plan.orders.length > 0 ? "1px" : undefined}>
      <Button
        variant="ghost"
        colorScheme="primary"
        size="xl"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen(!open)}
        w="full"
        justifyContent="flex-start"
        startIcon={<PlusIcon />}
      >
        注文を追加
        <Text as="span" fontWeight="normal" fontSize="xs" color="fg.muted">
          （Enter で追加して次の注文へ）
        </Text>
      </Button>
      {/* A plain form element: Yamada UI's `Form` comes with its own layout and footer. */}
      <styled.form
        id={formId}
        hidden={!open}
        display={open ? "flex" : "none"}
        flexDirection="column"
        gap="3"
        borderTopWidth="1px"
        pt="3.5"
        pb="4"
        px="4"
        noValidate
        onKeyDown={onKeyDown}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field
          label="商品のURL（貼るとショップを選びます）"
          error={urlUnknown ? "このURLからはショップを選べません" : undefined}
        >
          <Input
            size="lg"
            ref={firstField}
            type="url"
            placeholder="https://item.rakuten.co.jp/…"
            value={values.url}
            onChange={(event) => onUrl(event.currentTarget.value)}
          />
          <AutofillStatusText status={autofill.status} />
        </Field>
        <Box {...fieldGrid}>
          <Field label="ショップ" error={error("shop")}>
            <NativeSelect.Root
              size="lg"
              value={values.shop}
              onChange={(event) => chooseShop(event.currentTarget.value)}
            >
              <option value="">ショップを選ぶ</option>
              {sortedShops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
              <option value={NEW_SHOP}>＋ 新しいショップ</option>
            </NativeSelect.Root>
          </Field>
          {values.shop === NEW_SHOP ? (
            <Field label="新しいショップの名前" error={error("newShopName")}>
              <Input
                size="lg"
                value={values.newShopName}
                onChange={(event) => set({ newShopName: event.currentTarget.value })}
              />
            </Field>
          ) : null}
          <Field label="注文日" error={error("date")}>
            <Input
              size="lg"
              type="date"
              fontVariantNumeric="tabular-nums"
              value={values.date}
              onChange={(event) => set({ date: event.currentTarget.value })}
            />
          </Field>
          <Field label="商品名メモ">
            <Input
              size="lg"
              placeholder="例：洗濯洗剤"
              value={values.name}
              onChange={(event) => set({ name: event.currentTarget.value })}
            />
          </Field>
          <Field label="金額（税込）" error={error("amount")}>
            <Input
              size="lg"
              inputMode="numeric"
              placeholder="¥"
              fontVariantNumeric="tabular-nums"
              value={values.amount}
              onChange={(event) => set({ amount: event.currentTarget.value })}
            />
          </Field>
          <Field label="税率">
            <NativeSelect.Root
              size="lg"
              value={values.taxRate}
              onChange={(event) => set({ taxRate: event.currentTarget.value as TaxRateValue })}
            >
              <TaxRateOptions />
            </NativeSelect.Root>
          </Field>
          <Field label="ショップ独自倍率" error={error("shopPointRate")}>
            <Input
              size="lg"
              inputMode="decimal"
              placeholder="1"
              fontVariantNumeric="tabular-nums"
              value={values.shopPointRate}
              onChange={(event) => set({ shopPointRate: event.currentTarget.value })}
            />
          </Field>
        </Box>
        <Box display="flex" flexWrap="wrap" alignItems="center" gap="2">
          <ToggleChip pressed={values.is39} onClick={() => set({ is39: !values.is39 })}>
            39ショップ
          </ToggleChip>
          <ToggleChip pressed={values.repeat} onClick={() => set({ repeat: !values.repeat })}>
            リピート購入
          </ToggleChip>
          <Preview plan={plan} draft={draft} />
          <Button type="submit" colorScheme="primary" size="lg">
            追加する
          </Button>
        </Box>
      </styled.form>
    </List.Item>
  );
}
