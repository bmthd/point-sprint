// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { Field as FormField, useField } from "@formisch/react";
import type { Plan } from "@workspaces/domain";
import { Box, Field, Flex, Input, InputGroup, Separator, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useId } from "react";
import { bind, errorsOf } from "../../-form";
import { shopsAtom } from "../../../state/queries";
import { AutofillStatus } from "../-item-autofill";
import {
  AMOUNT_PATH,
  type OrderForm,
  applyShop,
  autofillUrlHandlers,
  type useOrderAutofill,
} from "../-order-form-store";
import { hasOrderTagCampaign } from "../-order-form";
import {
  CampaignCheck,
  ChannelField,
  OrderPart,
  ReadOnlyField,
  ShopRateInput,
  TaxRateButtons,
  UrlLabel,
  optionalMark,
  shopFromUrl,
} from "../-order-fields";
import { ShopAutocomplete } from "../-shop-autocomplete";
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
      label={<UrlLabel />}
      optionalIndicator={optionalMark}
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

/** What an order of several items shows in place of its item fields: each item has its own. */
export type SharedRates = { taxRate: string; shopPointRate: string };

function ItemFields({
  form,
  sharedRates,
}: {
  form: OrderForm;
  sharedRates: SharedRates | undefined;
}) {
  if (sharedRates) {
    return (
      <Flex wrap="wrap" gap="2.5" align="flex-start">
        <ReadOnlyField label="税率" value={sharedRates.taxRate} />
        <ReadOnlyField label="独自倍率" value={sharedRates.shopPointRate} />
      </Flex>
    );
  }
  return (
    <Flex wrap="wrap" gap="2.5" align="flex-start">
      <Box flex="1 1 13rem" minW="0">
        <FormField of={form} path={["items", 0, "name"]}>
          {(field) => (
            <Field.Root
              label="商品名"
              optionalIndicator={optionalMark}
              {...errorsOf(field)}
              minW="0"
            >
              <Input size="lg" placeholder="例：洗濯洗剤" {...bind(field)} />
            </Field.Root>
          )}
        </FormField>
      </Box>
      <Box w="48" flex="none">
        <FormField of={form} path={AMOUNT_PATH}>
          {(field) => (
            <Field.Root label="金額（税込）" {...errorsOf(field)} minW="0">
              <InputGroup.Root size="lg">
                <InputGroup.Addon aria-hidden="true">¥</InputGroup.Addon>
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  textAlign="end"
                  fontVariantNumeric="tabular-nums"
                  {...bind(field)}
                />
              </InputGroup.Root>
            </Field.Root>
          )}
        </FormField>
      </Box>
      {/* The rates go to the next line together, so neither is left there alone. */}
      <Flex gap="2.5" align="flex-start" flex="none">
        <FormField of={form} path={["items", 0, "taxRate"]}>
          {(field) => <TaxRateButtons field={field} size="lg" />}
        </FormField>
        <Box w="40" flex="none">
          <FormField of={form} path={["items", 0, "shopPointRate"]}>
            {(field) => <ShopRateInput field={field} size="lg" />}
          </FormField>
        </Box>
      </Flex>
    </Flex>
  );
}

function TagChips({ form, plan }: { form: OrderForm; plan: Plan }) {
  const shops = useAtomValue(shopsAtom);
  const shop = useField(form, { path: ["shop"] });
  const is39 = useField(form, { path: ["is39"] });
  const repeat = useField(form, { path: ["repeat"] });
  const brandDay = useField(form, { path: ["brandDay"] });
  const is24h = useField(form, { path: ["is24h"] });
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
      {/* Asked only when the plan has a brand day, or the order is marked already. */}
      {hasOrderTagCampaign(plan.benefits, "brand-day") || brandDay.input === true ? (
        <CampaignCheck
          campaign="brand-day"
          checked={brandDay.input === true}
          onChange={() => brandDay.onChange(!brandDay.input)}
        >
          ブランドデー対象
        </CampaignCheck>
      ) : null}
      <CampaignCheck
        campaign="24h"
        checked={is24h.input === true}
        onChange={() => is24h.onChange(!is24h.input)}
      >
        24時間限定
      </CampaignCheck>
    </Flex>
  );
}

/**
 * The URL, then the order in three parts: where it was bought, what was bought, and its
 * campaigns. An order of several items edits its items in 「商品を編集」, so it shows
 * `sharedRates` in place of their fields.
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
      <OrderPart legend="購入">
        <Flex wrap="wrap" gap="2.5" align="flex-start">
          <Box flex="1 1 13rem" minW="0">
            <ShopAutocomplete form={form} size="lg" />
          </Box>
          <Box w="40" flex="none">
            <ChannelField form={form} size="lg" />
          </Box>
          <Box w="44" flex="none">
            <FormField of={form} path={["date"]}>
              {(field) => (
                <Field.Root label="注文日" {...errorsOf(field)} minW="0">
                  <FormDatePicker size="lg" field={field} period={plan.period} />
                </Field.Root>
              )}
            </FormField>
          </Box>
        </Flex>
      </OrderPart>
      <Separator />
      <OrderPart legend="商品">
        <ItemFields form={form} sharedRates={sharedRates} />
      </OrderPart>
      <Separator />
      <OrderPart legend="キャンペーン">
        <TagChips form={form} plan={plan} />
      </OrderPart>
    </>
  );
}

/** The width of the buttons under the fields: 「追加する」, 「複製」 and 「削除」 are as wide. */
export const ACTION_BUTTON_WIDTH = "28";
