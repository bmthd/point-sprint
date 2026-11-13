// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { useField } from "@formisch/react";
import type { Plan } from "@workspaces/domain";
import { Flex, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { type ReactNode, useId } from "react";
import { shopsAtom } from "#/state/queries.ts";
import type { useOrderAutofill, OrderForm } from "#/routes/(plan)/-order-form-store.ts";
import { hasOrderTagCampaign } from "#/routes/(plan)/-order-form.ts";
import { CampaignCheck, OrderPart } from "#/routes/(plan)/-order-fields.tsx";
import {
  AmountField,
  Conditions,
  EntryModeSwitch,
  ShopAndName,
  UrlField,
  useEnterUrl,
} from "#/routes/(plan)/-order-entry.tsx";
import type { EntryMode } from "#/routes/(plan)/-ui.ts";
import { ExtraItems, ItemDetailFields } from "#/routes/(plan)/-item-details.tsx";

// The fields of an order in the desktop list, the same in 「＋ 注文を追加」 and in an opened row.

type Autofill = ReturnType<typeof useOrderAutofill>;

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
 * The order's fields. By its amount: the amount, then the shop and the item's name. By its URL:
 * the URL, then the shop and name it fills in, then the amount. Everything else is in 「条件」.
 * `onModeChange` shows the switch between the two; without it, a URL pasted into the amount still
 * turns the fields to the URL's. `estimate` sits beside the amount. `detailsOpen` opens 「条件」 at
 * first; `onItemRemoved` runs once an item after the first one is removed.
 */
export function OrderFormFields({
  form,
  plan,
  autofill,
  mode,
  onModeChange,
  showSwitch = true,
  estimate,
  detailsOpen = false,
  onItemRemoved,
}: {
  form: OrderForm;
  plan: Plan;
  autofill: Autofill;
  mode: EntryMode;
  onModeChange: (mode: EntryMode) => void;
  showSwitch?: boolean;
  estimate?: ReactNode;
  detailsOpen?: boolean;
  onItemRemoved?: () => void;
}) {
  const enterUrl = useEnterUrl(form, autofill);
  const amount = (
    <AmountField
      form={form}
      aside={estimate}
      onUrlPasted={(url) => {
        onModeChange("url");
        enterUrl(url);
      }}
    />
  );
  return (
    <>
      {showSwitch ? <EntryModeSwitch mode={mode} onChange={onModeChange} /> : null}
      {mode === "url" ? (
        <>
          <UrlField form={form} autofill={autofill} size="lg" />
          <ShopAndName form={form} size="lg" />
          {amount}
        </>
      ) : (
        <>
          {amount}
          <ShopAndName form={form} size="lg" />
        </>
      )}
      <Conditions
        form={form}
        plan={plan}
        size="lg"
        defaultOpen={detailsOpen}
        campaigns={
          <OrderPart legend="キャンペーン">
            <TagChips form={form} plan={plan} />
          </OrderPart>
        }
      >
        <Flex direction="column" gap="2" maxW="md">
          <ItemDetailFields form={form} index={0} withRate={false} size="lg" />
          <ExtraItems form={form} onRemove={onItemRemoved} size="lg" />
        </Flex>
      </Conditions>
    </>
  );
}

/** The width of the buttons under the fields: 「追加する」, 「複製」 and 「削除」 are as wide. */
export const ACTION_BUTTON_WIDTH = "28";
