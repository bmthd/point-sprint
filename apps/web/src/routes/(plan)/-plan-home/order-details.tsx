// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { selectAtom } from "jotai/utils";
import { planAtom, orderAtom } from "#/state/derived.ts";

import { Field as FormField, useField } from "@formisch/react";
import { hasOrderTagCampaign, type Plan, deepEqual } from "@workspaces/domain";
import { Field, Flex, Grid, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useId } from "react";
import { errorsOf } from "#/routes/-form.tsx";

import { shopsAtom } from "#/state/query-atoms.ts";
import type { OrderForm } from "#/routes/(plan)/-order-form-store.ts";
import {
  CampaignCheck,
  ChannelField,
  OrderPart,
  ShopRateInput,
  TaxRateButtons,
} from "#/routes/(plan)/-order-fields.tsx";
import { FormDatePicker } from "#/routes/(plan)/-date-picker-field.tsx";
import { ShopAutocomplete } from "#/routes/(plan)/-shop-autocomplete.tsx";
import { UrlField } from "#/routes/(plan)/-order-entry.tsx";
import type { ItemAutofill } from "#/routes/(plan)/-item-autofill.tsx";
import { ExtraItems, ItemDetailFields } from "#/routes/(plan)/-item-details.tsx";
import { RakutenCardSwitch } from "#/routes/(plan)/-rakuten-card-switch.tsx";

// What an opened row of the desktop table holds, the same for an order and for the add row's new
// order: the conditions at once, with no 「条件」 to open first. The item's name and amount are on
// the row itself.

function TagChips({ form, planId }: { form: OrderForm; planId: string }) {
  const benefits = useAtomValue(selectAtom(planAtom(planId), planBenefits, deepEqual));
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
    <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="2">
      <CampaignCheck
        campaign="39shop"
        checked={is39.input === true}
        describedBy={saved ? hintId : undefined}
        onChange={() => is39.onChange(!is39.input)}
      >
        39ショップ
      </CampaignCheck>
      {saved ? (
        <Text id={hintId} fontSize="xs" color="fg.muted" gridColumn="1 / -1" gridRow="2">
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
      {hasOrderTagCampaign(benefits, "brand-day") || brandDay.input === true ? (
        <CampaignCheck
          campaign="brand-day"
          checked={brandDay.input === true}
          onChange={() => brandDay.onChange(!brandDay.input)}
        >
          ブランドデー対象
        </CampaignCheck>
      ) : null}
      {hasOrderTagCampaign(benefits, "24h") || is24h.input === true ? (
        <CampaignCheck
          campaign="24h"
          checked={is24h.input === true}
          onChange={() => is24h.onChange(!is24h.input)}
        >
          24時間限定
        </CampaignCheck>
      ) : null}
    </Grid>
  );
}

/**
 * The order's conditions: where (shop, URL, channel) and when, the tax and shop rates, the
 * campaigns, then its items past the first one's name and amount, which are on the row or on the
 * item's line. `onItemRemoved` runs once an item after the first one is removed.
 */
export function OrderDetailFields({
  form,
  planId,
  autofill,
  orderId,
  onItemRemoved,
}: {
  form: OrderForm;
  planId: string;
  autofill: ItemAutofill;
  /** The order the fields edit, saved already. */
  orderId?: string;
  onItemRemoved?: () => void;
}) {
  const plan = useAtomValue(planAtom(planId));
  const original = useAtomValue(orderAtom({ planId, orderId: orderId ?? "" }));
  const period = plan?.period;
  return (
    <Flex direction="column" gap="3.5">
      <Grid templateColumns="repeat(auto-fit, minmax(14rem, 1fr))" alignItems="start" gap="2.5">
        <ShopAutocomplete form={form} size="lg" />
        <UrlField form={form} autofill={autofill} size="lg" />
      </Grid>
      <Grid templateColumns="repeat(auto-fit, minmax(10rem, 1fr))" alignItems="start" gap="2.5">
        <ChannelField form={form} size="lg" />
        <FormField of={form} path={["date"]}>
          {(field) => (
            <Field.Root label="注文日" {...errorsOf(field)} minW="0">
              <FormDatePicker size="lg" field={field} period={period} />
            </Field.Root>
          )}
        </FormField>
      </Grid>
      {/* The shop rate keeps its narrow width beside the tax rate, and goes under it when the tax
          rate's choices would not fit beside it. */}
      <Flex wrap="wrap" align="flex-start" gap="2.5">
        <FormField of={form} path={["items", 0, "taxRate"]}>
          {(field) => <TaxRateButtons field={field} size="lg" fill />}
        </FormField>
        <FormField of={form} path={["items", 0, "shopPointRate"]}>
          {(field) => <ShopRateInput field={field} size="lg" />}
        </FormField>
      </Flex>
      <OrderPart legend="キャンペーン">
        <TagChips form={form} planId={planId} />
      </OrderPart>
      <OrderPart legend="数量・クーポン・商品">
        <Flex direction="column" gap="2" maxW="xl">
          <Flex direction="column" gap="2" maxW="md">
            <ItemDetailFields form={form} index={0} withRate={false} size="lg" />
            {plan ? <RakutenCardSwitch form={form} plan={plan} original={original} /> : null}
          </Flex>
          <ExtraItems form={form} onRemove={onItemRemoved} size="lg" />
        </Flex>
      </OrderPart>
    </Flex>
  );
}

/** The width of 「複製」 and 「削除」 under an opened row, and of the add row's 「追加する」. */
export const ACTION_BUTTON_WIDTH = "28";

const planBenefits = (plan: Plan | undefined) => plan?.benefits ?? [];
