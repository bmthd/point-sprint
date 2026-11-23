// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { Field as FormField, useField } from "@formisch/react";
import {
  type Order,
  type Plan,
  type RakutenCardPart,
  hasRakutenCardCampaign,
  hasRakutenCardSpu,
  planAccountId,
} from "@workspaces/domain";
import { Flex, Switch, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useDeferredValue, useId, useMemo } from "react";
import { pointsText } from "#/ui/format.ts";
import { asCalculatedAtom } from "#/state/derived.ts";
import { plansAtom, shopsAtom, spuMonthsAtom } from "#/state/query-atoms.ts";
import { type OrderForm, useFormInput } from "./-order-form-store.ts";
import { draftOfInput } from "./-order-form.ts";
import { rakutenCardLossOf } from "./-order-editor/order-preview.tsx";

const PART_NAMES: Record<RakutenCardPart, string> = {
  normal: "通常分",
  bonus: "特典分",
  bank: "楽天銀行",
  "ichiba-course": "楽天市場コース",
};

/** 「通常分と特典分」, or with 楽天銀行 「通常分・特典分・楽天銀行」. */
function partsText(parts: RakutenCardPart[]) {
  const names = parts.map((part) => PART_NAMES[part]);
  if (names.length === 0) return "楽天カードの分";
  return names.length === 2 ? names.join("と") : names.join("・");
}

/** What the order gets from the 楽天カード's items, calculated a keystroke behind the form. */
function useRakutenCardPoints(form: OrderForm, planId: string, original: Order | undefined) {
  const plans = useAtomValue(plansAtom);
  const shops = useAtomValue(shopsAtom);
  const asCalculated = useAtomValue(asCalculatedAtom);
  const key = JSON.stringify(useFormInput(form));
  const deferred = useDeferredValue(key);
  return useMemo(() => {
    const draft = draftOfInput(JSON.parse(deferred), shops, original);
    return draft
      ? rakutenCardLossOf({ plans, asCalculated, shops, planId, draft, original })
      : undefined;
  }, [deferred, plans, shops, asCalculated, planId, original]);
}

/**
 * 「楽天カードのポイント」: on unless the order was paid otherwise, which takes the card's items off
 * it. Asked only when the order's month has the card's SPU on, the plan has a campaign of the card
 * on (楽天市場コース), or the order is marked already.
 */
export function RakutenCardSwitch({
  form,
  plan,
  original,
}: {
  form: OrderForm;
  plan: Plan;
  original?: Order;
}) {
  const months = useAtomValue(spuMonthsAtom);
  const date = useField(form, { path: ["date"] });
  const paid = useField(form, { path: ["rakutenCard"] });
  const month = typeof date.input === "string" ? date.input.slice(0, 7) : "";
  const asked =
    hasRakutenCardSpu(months, planAccountId(plan), month) ||
    hasRakutenCardCampaign(plan) ||
    paid.input === false;
  return asked ? <CardSwitch form={form} planId={plan.id} original={original} /> : null;
}

function CardSwitch({
  form,
  planId,
  original,
}: {
  form: OrderForm;
  planId: string;
  original: Order | undefined;
}) {
  const card = useRakutenCardPoints(form, planId, original);
  const hintId = useId();
  const points = card && card.points > 0 ? pointsText(card.points) : undefined;
  return (
    <FormField of={form} path={["rakutenCard"]}>
      {(field) => (
        <Flex direction="column" gap="0.5">
          <Switch
            {...field.props}
            checked={field.input === true}
            colorScheme="primary"
            reverse
            justifyContent="space-between"
            // The whole row is the switch's label: a 44px tap target.
            minH="11"
            inputProps={{ "aria-describedby": hintId }}
          >
            楽天カードのポイント
            {points && field.input === true ? (
              <Text as="span" color="fg.muted" fontVariantNumeric="tabular-nums">
                {" "}
                +{points}
              </Text>
            ) : null}
          </Switch>
          <Flex id={hintId} direction="column" fontSize="xs" color="fg.muted">
            <Text as="span">他の支払い方法で払った注文ではオフに</Text>
            {field.input === true ? null : (
              <Text as="span" color="primary.fg">
                {partsText(card?.parts ?? [])}
                {points ? `の ${points}` : ""}を外して計算しています
              </Text>
            )}
          </Flex>
        </Flex>
      )}
    </FormField>
  );
}
