// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { Field as FormField, setInput, useField } from "@formisch/react";
import { type Plan, channels } from "@workspaces/domain";
import { Box, Field, Flex, Input, NativeSelect, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useId } from "react";
import { bind, errorsOf } from "../../../form/form";
import { shopsAtom } from "../../../state/queries";
import { AutofillStatus } from "../-item-autofill";
import {
  AMOUNT_PATH,
  type OrderForm,
  applyShop,
  autofillUrlHandlers,
  type useOrderAutofill,
} from "../-order-editor/order-form-store";
import {
  NEW_SHOP,
  CampaignCheck,
  ReadOnlyField,
  TaxRateOptions,
  fieldGrid,
  shopFromUrl,
  useSortedShops,
} from "../-order-fields";
import { FormDatePicker } from "../-date-picker-field";

// The fields of an order in the desktop list, the same in 「＋ 注文を追加」 and in an opened row.

type Autofill = ReturnType<typeof useOrderAutofill>;

function UrlField({ form, autofill }: { form: OrderForm; autofill: Autofill }) {
  const shops = useAtomValue(shopsAtom);
  const url = useField(form, { path: ["url"] });
  const text = typeof url.input === "string" ? url.input.trim() : "";
  // Not an error: the order can still be saved with a URL no shop is chosen from.
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
        {...autofillUrlHandlers(
          autofill,
          (value) => {
            url.onChange(value);
            const found = shopFromUrl(value, shops);
            if (found) applyShop(form, found);
          },
          url.props.onBlur,
        )}
      />
      <AutofillStatus autofill={autofill} />
    </Field.Root>
  );
}

function ShopField({ form }: { form: OrderForm }) {
  const shops = useAtomValue(shopsAtom);
  const sortedShops = useSortedShops(shops);
  const shop = useField(form, { path: ["shop"] });
  const known =
    shop.input === "" || shop.input === NEW_SHOP || shops.some((other) => other.id === shop.input);

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
          <option value="">未入力</option>
          {known ? null : <option value={String(shop.input)}>不明なショップ</option>}
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
      {shop.input === "" || shop.input === NEW_SHOP ? (
        <FormField of={form} path={["channel"]}>
          {(field) => (
            <Field.Root label="購入先" {...errorsOf(field)} minW="0">
              <NativeSelect.Root size="lg" {...bind(field)}>
                {Object.values(channels).map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.label}
                  </option>
                ))}
              </NativeSelect.Root>
            </Field.Root>
          )}
        </FormField>
      ) : null}
    </>
  );
}

/** What an order of several items shows in place of its item fields: each item has its own. */
export type SharedRates = { taxRate: string; shopPointRate: string };

function ItemFields({
  form,
  plan,
  sharedRates,
}: {
  form: OrderForm;
  plan: Plan;
  sharedRates: SharedRates | undefined;
}) {
  return (
    <>
      <FormField of={form} path={["date"]}>
        {(field) => (
          <Field.Root label="注文日" {...errorsOf(field)} minW="0">
            <FormDatePicker size="lg" field={field} period={plan.period} />
          </Field.Root>
        )}
      </FormField>
      {sharedRates ? (
        <>
          <ReadOnlyField label="税率" value={sharedRates.taxRate} />
          <ReadOnlyField label="ショップ独自倍率" value={sharedRates.shopPointRate} />
        </>
      ) : (
        <>
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
      )}
    </>
  );
}

function TagChips({ form }: { form: OrderForm }) {
  const shops = useAtomValue(shopsAtom);
  const shop = useField(form, { path: ["shop"] });
  const is39 = useField(form, { path: ["is39"] });
  const repeat = useField(form, { path: ["repeat"] });
  const hintId = useId();
  // The mark belongs to the shop, so a shop that is saved already gets it on every order.
  const saved = shops.some((other) => other.id === shop.input);
  return (
    <Flex wrap="wrap" align="center" gap="2">
      <CampaignCheck
        campaign="39shop"
        checked={is39.input === true}
        describedBy={saved ? hintId : undefined}
        onChange={() => is39.onChange(!is39.input)}
      >
        39ショップ
      </CampaignCheck>
      {saved ? (
        <Text id={hintId} fontSize="xs" color="fg.muted">
          このショップの注文すべてに反映されます
        </Text>
      ) : null}
      <CampaignCheck
        campaign="repeat"
        checked={repeat.input === true}
        onChange={() => repeat.onChange(!repeat.input)}
      >
        リピート購入
      </CampaignCheck>
    </Flex>
  );
}

/**
 * The URL, the shop and the item, then the campaigns. An order of several items edits its items in
 * 「商品を編集」, so it shows `sharedRates` in place of their fields.
 */
export function OrderFormFields({
  form,
  plan,
  autofill,
  sharedRates,
}: {
  form: OrderForm;
  plan: Plan;
  autofill: Autofill;
  sharedRates?: SharedRates;
}) {
  return (
    <>
      <UrlField form={form} autofill={autofill} />
      <Box {...fieldGrid}>
        <ShopField form={form} />
        <ItemFields form={form} plan={plan} sharedRates={sharedRates} />
      </Box>
      <TagChips form={form} />
    </>
  );
}

/** The width of the buttons under the fields: 「追加する」, 「複製」 and 「削除」 are as wide. */
export const ACTION_BUTTON_WIDTH = "28";
