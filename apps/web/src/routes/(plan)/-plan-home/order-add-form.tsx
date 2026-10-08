// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { Field as FormField, focus, reset, setInput, useField, useForm } from "@formisch/react";
import { type Plan, calculateAll } from "@workspaces/domain";
import { Box, Button, Field, Input, List, NativeSelect, Text } from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { type KeyboardEvent, useDeferredValue, useId, useMemo, useState } from "react";
import { Form, bind, errorsOf } from "../../../form/form";
import { calculationAtom } from "../../../state/derived";
import { saveShopAtom } from "../../../state/mutations";
import { addOrderAtom } from "../../../state/order-ops";
import { plansAtom, shopsAtom } from "../../../state/queries";
import { useSingleFlight } from "../../../use-single-flight";
import { AutofillStatusText } from "../-item-autofill";
import {
  OrderFormSchema,
  type OrderFormOutput,
  draftOf,
  draftOfInput,
  emptyInput,
} from "../-order-editor/order-form";
import {
  AMOUNT_PATH,
  type OrderForm,
  applyShop,
  useFormInput,
  useOrderAutofill,
} from "../-order-editor/order-form-store";
import { PlusIcon } from "../../../ui/icons";
import {
  NEW_SHOP,
  TaxRateOptions,
  ToggleChip,
  fieldGrid,
  shopFromUrl,
  useSortedShops,
} from "../-order-fields";
import { orderSaveFailedAtom, pointsText } from "../-order-shared";

const sumOfTotals = (results: Map<string, { total: number }>) =>
  [...results.values()].reduce((sum, result) => sum + result.total, 0);

/** 「この注文で（5店舗目） 約 +120P」 while the form is valid. */
function Preview({ plan, form }: { plan: Plan; form: OrderForm }) {
  const plans = useAtomValue(plansAtom);
  const shops = useAtomValue(shopsAtom);
  const before = useAtomValue(calculationAtom);
  const key = JSON.stringify(useFormInput(form));
  // Calculating every plan again is the heavy part, so it may lag a keystroke behind.
  const deferred = useDeferredValue(key);
  const preview = useMemo(() => {
    const draft = draftOfInput(JSON.parse(deferred), shops, undefined);
    if (!draft) return undefined;
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
  }, [deferred, plans, shops, before, plan.id]);

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

type Autofill = ReturnType<typeof useOrderAutofill>;

function UrlField({ form, autofill }: { form: OrderForm; autofill: Autofill }) {
  const shops = useAtomValue(shopsAtom);
  const url = useField(form, { path: ["url"] });
  const text = typeof url.input === "string" ? url.input.trim() : "";
  // Not an error: the order can still be added with a URL no shop is chosen from.
  const unknown = url.errors === null && text !== "" && shopFromUrl(text, shops) === null;

  return (
    <Field.Root
      label="商品のURL（貼るとショップを選びます）"
      {...errorsOf(url)}
      helperMessage={unknown ? "このURLからはショップを選べません" : undefined}
      minW="0"
    >
      <Input
        size="lg"
        type="url"
        placeholder="https://item.rakuten.co.jp/…"
        {...bind(url)}
        // The shop of the URL is chosen at once, and stays when the item cannot be looked up.
        onChange={(event) => {
          const value = event.currentTarget.value;
          url.onChange(value);
          const found = shopFromUrl(value, shops);
          if (found) applyShop(form, found);
          autofill.onUrl(value);
        }}
      />
      <AutofillStatusText status={autofill.status} />
    </Field.Root>
  );
}

function ShopField({ form }: { form: OrderForm }) {
  const shops = useAtomValue(shopsAtom);
  const sortedShops = useSortedShops(shops);
  const shop = useField(form, { path: ["shop"] });

  return (
    <>
      <Field.Root label="ショップ" {...errorsOf(shop)} minW="0">
        <NativeSelect.Root
          size="lg"
          {...bind(shop)}
          onChange={(event) => {
            const value = event.currentTarget.value;
            shop.onChange(value);
            const chosen = shops.find((other) => other.id === value);
            setInput(form, { path: ["is39"], input: chosen?.tags.includes("39shop") ?? false });
          }}
        >
          <option value="">ショップを選ぶ</option>
          {sortedShops.map((other) => (
            <option key={other.id} value={other.id}>
              {other.name}
            </option>
          ))}
          <option value={NEW_SHOP}>＋ 新しいショップ</option>
        </NativeSelect.Root>
      </Field.Root>
      {shop.input === NEW_SHOP ? (
        <FormField of={form} path={["newShopName"]}>
          {(field) => (
            <Field.Root label="新しいショップの名前" {...errorsOf(field)} minW="0">
              <Input size="lg" {...bind(field)} />
            </Field.Root>
          )}
        </FormField>
      ) : null}
    </>
  );
}

function ItemFields({ form }: { form: OrderForm }) {
  return (
    <>
      <FormField of={form} path={["date"]}>
        {(field) => (
          <Field.Root label="注文日" {...errorsOf(field)} minW="0">
            <Input size="lg" type="date" fontVariantNumeric="tabular-nums" {...bind(field)} />
          </Field.Root>
        )}
      </FormField>
      <FormField of={form} path={["items", 0, "name"]}>
        {(field) => (
          <Field.Root label="商品名メモ" {...errorsOf(field)} minW="0">
            <Input size="lg" placeholder="例：洗濯洗剤" {...bind(field)} />
          </Field.Root>
        )}
      </FormField>
      <FormField of={form} path={AMOUNT_PATH}>
        {(field) => (
          <Field.Root label="金額（税込）" {...errorsOf(field)} minW="0">
            <Input
              size="lg"
              inputMode="numeric"
              placeholder="¥"
              fontVariantNumeric="tabular-nums"
              {...bind(field)}
            />
          </Field.Root>
        )}
      </FormField>
      <FormField of={form} path={["items", 0, "taxRate"]}>
        {(field) => (
          <Field.Root label="税率" {...errorsOf(field)} minW="0">
            <NativeSelect.Root size="lg" {...bind(field)}>
              <TaxRateOptions />
            </NativeSelect.Root>
          </Field.Root>
        )}
      </FormField>
      <FormField of={form} path={["items", 0, "shopPointRate"]}>
        {(field) => (
          <Field.Root label="ショップ独自倍率" {...errorsOf(field)} minW="0">
            <Input
              size="lg"
              inputMode="decimal"
              placeholder="1"
              fontVariantNumeric="tabular-nums"
              {...bind(field)}
            />
          </Field.Root>
        )}
      </FormField>
    </>
  );
}

function TagChips({ form }: { form: OrderForm }) {
  const is39 = useField(form, { path: ["is39"] });
  const repeat = useField(form, { path: ["repeat"] });
  return (
    <>
      <ToggleChip pressed={is39.input === true} onClick={() => is39.onChange(!is39.input)}>
        39ショップ
      </ToggleChip>
      <ToggleChip pressed={repeat.input === true} onClick={() => repeat.onChange(!repeat.input)}>
        リピート購入
      </ToggleChip>
    </>
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
  const run = useSingleFlight();
  const [open, setOpen] = useState(plan.orders.length === 0);
  const form = useForm({ schema: OrderFormSchema, initialInput: emptyInput() });
  const autofill = useOrderAutofill(form);
  const formId = useId();

  const add = (output: OrderFormOutput) =>
    run(async () => {
      const draft = draftOf(output, shops, undefined);
      setFailed(draft === undefined);
      if (!draft) return;
      try {
        if (draft.shopChange) await saveShop.mutateAsync(draft.shopChange);
        await addOrder({ planId: plan.id, order: draft.order });
        autofill.reset();
        reset(form, { initialInput: emptyInput() });
        focus(form, { path: ["url"] });
      } catch {
        // The typed order stays in the form so it can be added again.
        setFailed(true);
      }
    });

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    event.currentTarget.requestSubmit();
  };

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
      <Form of={form} id={formId} hidden={!open} onKeyDown={onKeyDown} onSubmit={add}>
        <Box
          display="flex"
          flexDirection="column"
          gap="3"
          borderTopWidth="1px"
          pt="3.5"
          pb="4"
          px="4"
        >
          <UrlField form={form} autofill={autofill} />
          <Box {...fieldGrid}>
            <ShopField form={form} />
            <ItemFields form={form} />
          </Box>
          <Box display="flex" flexWrap="wrap" alignItems="center" gap="2">
            <TagChips form={form} />
            <Preview plan={plan} form={form} />
            <Button type="submit" colorScheme="primary" size="lg">
              追加する
            </Button>
          </Box>
        </Box>
      </Form>
    </List.Item>
  );
}
